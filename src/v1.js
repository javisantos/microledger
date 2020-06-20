import raf from 'random-access-file'
import ram from 'random-access-memory'
import promisify from 'util.promisify'
import sgl from 'simple-grant-lang'

import { v1 as faythe } from 'faythe'

import uint64be from 'uint64be'
import AppendOnlyObject from 'append-only-object'

import Lru from 'quick-lru'
import { Buffer } from 'buffer'

const KEY = Buffer.alloc(32).fill('mciroledger')

class Node {
  constructor (AppendOnlyObject, previousNode, value, seq, keyPair, opts = {}) {
    this.keyPair = keyPair
    this.previousNode = previousNode
    this.seq = seq
    this.value = value
    this.AppendOnlyObject = AppendOnlyObject
    return this.generate(opts)
  }

  generate (opts) {
    let node
    if (!this.AppendOnlyObject) {
      node = {
        previousNode: { hash: 'genesis' },
        seq: -1,
        state: this.value,
        delta: this.value,
        patch: []
      }
    } else {
      const appended = this.AppendOnlyObject.append(this.value, { patch: true, ...opts })
      node = {
        previousNode: { hash: this.previousNode.hash || null },
        seq: this.seq,
        state: JSON.parse(JSON.stringify(this.AppendOnlyObject)),
        delta: this.value,
        patch: appended.patch
      }
    }

    if (this.keyPair) {
      const salt = faythe.randomBytes(faythe.SALTBYTES)
      const signature = faythe.sign(this.keyPair, faythe.serialize(node), salt)
      node.by = {
        key: this.keyPair.publicKey,
        salt: salt,
        signature: signature
      }
    }

    node.hash = faythe.hash(faythe.serialize(node), { key: KEY })
    return node
  }
}

export default class Microledger {
  constructor (storage, opts = {}) {
    if (typeof storage === 'object') {
      opts = storage
      storage = null
    }
    this.storage = storage

    if (typeof storage === 'string') this.file = raf(storage)
    if (typeof storage === 'object') this.file = ram()
    if (typeof storage === 'function') this.file = storage()
    this.opened = false
    this.size = 0
    this.seq = 0
    this.destroy = promisify(this.file.destroy).bind(this.file)
    this.read = promisify(this.file.read).bind(this.file)
    this.del = promisify(this.file.del).bind(this.file)
    this.write = promisify(this.file.write).bind(this.file)
    this.stat = promisify(this.file.stat).bind(this.file)
    this.open = promisify(this.file.open).bind(this.file)
    this.version = '01'
    this.keyPair = opts.keyPair || null
    this.sgl = opts.sgl || null
    this.mode = `${opts.secretKey ? '1' : '0'}${this.keyPair ? opts.sgl ? '2' : '1' : '0'}`
    this.secretKey = opts.secretKey ? faythe.hash(opts.secretKey, { key: KEY }) : null

    this.genesis = opts.genesis ? JSON.parse(JSON.stringify(opts.genesis)) : {}

    if (this.sgl) this._validateSglGenesis(this.genesis, this.keyPair)

    this.AppendOnlyObject = null

    this.cache = new Lru({ maxSize: opts.cache ? opts.cache : 65536 })
    this.ready = this._open
  }

  // HEADER version 0,2 | mode 2,4  | genesislength = 4,12

  _open () {
    return new Promise((resolve) => {
      if (this.opened) resolve(true)
      this.stat()
        .then((stat) => {
          if (stat.size === 0) return this.start(resolve) // ram
          this.read(0, 12).then(async (header) => {
            if (header.slice(0, 2).toString('utf8') !== this.version) throw new Error('version mismatch')
            if (header.slice(2, 4).toString('utf8') !== this.mode) throw new Error('mode mismatch')

            const genesisBuffer = await this.read(12, uint64be.decode(header.slice(4, 12)))

            this.genesis = this.secretKey
              ? faythe.deserialize(faythe.secretDecrypt(this.secretKey, genesisBuffer))
              : faythe.deserialize(this.genesis)

            this.stat()
              .then(async (stat) => {
                this.size = stat.size - 8 // reverse length 8 to overwrite
                const last = await this.last()
                this.AppendOnlyObject = new AppendOnlyObject(last.state)
                this.seq = last.seq + 1
                this.opened = true
                resolve()
              })
          })
        })
        .catch((error) => {
          if (error.code === 'ENOENT') {
            this.start(resolve)
          } else {
            throw error
          }
        })
    })
  }

  start (resolve) {
    this.AppendOnlyObject = new AppendOnlyObject(Object.assign({}, this.genesis))
    this.genesis = new Node(null, null, Object.assign({}, this.genesis), -1, this.keyPair)
    const genesis = this.secretKey
      ? faythe.secretEncrypt(this.secretKey, Buffer.from(faythe.serialize(this.genesis)))
      : faythe.serialize(this.genesis)
    const length = uint64be.encode(genesis.length)
    const genesisBuffer = Buffer.concat([
      Buffer.from(length),
      Buffer.from(genesis),
      Buffer.from(length)
    ])

    const header = Buffer.concat([
      Buffer.from(this.version),
      Buffer.from(this.mode),
      genesisBuffer
    ])

    this.write(0, header).then(() => {
      this.opened = true
      this.size = header.length - 8
      this.seq = 0
      resolve()
    })
  }

  async append (value, opts = {}) {
    if (!this.opened) await this.ready()

    const previousNode = this.seq > -1 ? await this.last() : this.genesis

    const node = new Node(this.AppendOnlyObject, previousNode, JSON.parse(JSON.stringify(value)), this.seq, this.keyPair, opts)

    if (this.sgl && await this.granted(node, previousNode) === false) throw new Error('Not allowed')

    const serialized = faythe.serialize(node)
    const data = this.secretKey ? faythe.secretEncrypt(this.secretKey, Buffer.from(serialized)) : serialized
    const length = uint64be.encode(data.length)

    const toAppend = Buffer.concat([
      Buffer.from(length),
      Buffer.from(data)
    ])

    this.cache.set(this.seq, { value: Buffer.from(data), offset: this.size + 8, length: data.length })

    try {
      this.seq++
      await this.write(this.size, toAppend)
      this.size += toAppend.length
      await this.write(this.size, Buffer.from(length)) // allow reverse

      return node
    } catch (error) {
      throw new Error(error)
    }
  }

  async get (seq) {
    if (!this.opened) await this.ready()

    if (seq === -1) return this.genesis

    if (typeof seq !== 'number' || seq < -1) return null
    if (seq > this.seq) return null

    if (this.cache.has(seq)) {
      const cached = this.cache.get(seq)
      const cresult = cached.value
      try {
        return this.secretKey ? faythe.deserialize(faythe.secretDecrypt(this.secretKey, cresult)) : faythe.deserialize(cresult)
      } catch (error) {
        throw new Error(error)
      }
    }
    seq++
    let result = null
    let current = -1
    let offset = 4

    try {
      let length = uint64be.decode(await this.read(offset, 8))

      while (current !== seq) {
        current++
        if (current === seq) {
          result = await this.read(offset + 8, length)
          this.cache.set(current - 1, { seq, value: result, offset: offset + 8, length })
          return this.secretKey ? faythe.deserialize(faythe.secretDecrypt(this.secretKey, result)) : faythe.deserialize(result)
        }
        offset += length + 8

        if (offset < this.size) {
          length = uint64be.decode(await this.read(offset, 8))
        }
      }
    } catch (error) {
      return null
    }
  }

  async last () {
    const length = await this.read(this.size, 8)

    const result = await this.read(this.size - uint64be.decode(length), uint64be.decode(length))

    return this.secretKey ? faythe.deserialize(faythe.secretDecrypt(this.secretKey, result)) : faythe.deserialize(result)
  }

  * [Symbol.iterator] () {
    for (var i = -1; i < this.seq; i++) {
      yield this.get(i)
    }
  }

  async verify (seq) {
    if (seq === 'all') return this.verified()
    if (seq < -1) return false

    const node = await this.get(seq)

    if (!node) return false

    if (seq > -1) {
      const previousNode = await this.get(seq - 1)
      const previousHash = previousNode.hash
      if (Buffer.from(previousHash).toString('hex') !==
      Buffer.from(node.previousNode.hash).toString('hex')) return false
    }

    return this._verify(node)
  }

  async verified () {
    for await (const node of this) {
      const toVerify = await node
      if (!this._verify(toVerify)) return false
    }
    return true
  }

  _verify (node) {
    const toVerify = { ...node }
    let verifySignature = false
    let verifyHash = false
    const nodeHash = toVerify.hash

    delete toVerify.hash
    verifyHash = faythe.hash(faythe.serialize(toVerify))
    if (toVerify.by) {
      const by = toVerify.by
      delete toVerify.by
      verifySignature = faythe.verify(
        Buffer.from(by.key),
        faythe.serialize(toVerify),
        Buffer.from(by.signature),
        Buffer.from(by.salt))
    } else { verifySignature = true }
    return (verifyHash.toString('hex') === Buffer.from(nodeHash).toString('hex')) && verifySignature
  }

  _validateSglGenesis (genesis, keyPair) {
    if (!keyPair) throw new Error('Sgl: keyPair option is required')
    if (!genesis.publicKey) throw new Error('Sgl: publicKey property is required')
    if (!genesis.authorization) throw new Error('Sgl: authorization property is required')
    if (!Object.keys(this.genesis.authorization).every(key => ['profiles', 'rules'].includes(key))) throw new Error('Sgl: profile and rules properties are required')
    return true
  }

  async granted (next, previous) {
    if (!this._verify(next)) return false

    const key = `${faythe.encode(this.keyPair.publicKey).toString().substring(1, 8)}`
    const profile = previous.state.authorization.profiles.filter((profile) => profile.key === `#${key}`)[0]
    profile.id = `#${key}`

    const granted = new Set()
    previous.state.authorization.rules.forEach((rule) => {
      if (sgl.satisfies(profile, rule)) {
        rule.grant.forEach((grant) => granted.add(grant))
      }
    })

    const grant = [true]

    this.sgl.forEach((protect) => {
      next.patch.forEach((patch) => {
        const path = patch.path
        if (path.startsWith(protect.path)) {
          grant.push(granted.has(protect.grant))
        }
      })
    })

    return grant.every((success) => success === true)
  }

  static get Identity () {
    return faythe.Identity
  }
}

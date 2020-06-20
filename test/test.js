// require = require('esm')(module)

const test = require('tape')
const tapSpec = require('tap-spec')
const Microledger = require('..')

test.createStream()
  .pipe(tapSpec())
  .pipe(process.stdout)

const genesis = {
  version: 1
}

const G1 = {
  greetings: 'Hello world'
}
const G2 = { greetings: 'Hey!' }

const log = new Microledger({ secretKey: 'secretKey', genesis, debug: true })

test('GET genesis', async (t) => {
  const h = await log.get(-1)

  t.deepEqual(h.delta.version, 1, 'Should get the genesis')
  t.end()
})

test('Append0', async (t) => {
  const appended = await log.append(G1)

  t.deepEqual(appended.delta, G1, 'Should be true!')
  t.end()
})

test('Append1', async (t) => {
  const appended = await log.append(G2)

  t.deepEqual(appended.delta, G2, 'Should be true!')
  t.end()
})

test('GET genesis', async (t) => {
  const h = await log.get(-1)
  t.deepEqual(h.delta.version, 1, 'Should get the genesis')
  t.end()
})

test('GET0', async (t) => {
  const node = await log.get(0)
  t.deepEqual(node.delta, G1, 'Should be true!')
  t.end()
})

test('GET1', async (t) => {
  const node = await log.get(1)

  t.deepEqual(node.delta, G2, 'Should be true!')
  t.end()
})

test('verify', async (t) => {
  const verified = await log.verify(-1)
  t.deepEqual(verified, true, 'Should be true!')
  t.end()
})

test('last', async (t) => {
  const last = await log.last()
  console.log(last)
  // t.deepEqual(verified, true, 'Should be true!')
  t.end()
})

test.onFinish(async () => {
  // await log.destroy()
})

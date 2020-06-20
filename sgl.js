const Microledger = require('.')
const util = require('util')

const keyPair = new Microledger.Identity('Yeah', 'local', 'Alice')

// peer did spec

const genesis = {
  publicKey: [keyPair.toJson()],
  authorization: {
    profiles: [
      {
        key: `#${keyPair.toJson().id}`,
        roles: ['edge']
      }
    ],
    rules: [
      {
        grant: ['register', 'key_admin', 'se_admin', 'rule_admin'],
        when: { id: `#${keyPair.toJson().id}` }
      },
      {
        grant: ['authcrypt', 'plaintext', 'sign'],
        when: { roles: 'edge' }
      },
      {
        grant: ['route', 'authcrypt'],
        when: { roles: 'cloud' }
      }
    ]
  }
}

const sgl = [{
  path: '/publicKey',
  grant: 'key_admin'
},
{
  path: '/authorization/profiles',
  grant: 'key_admin'
},
{
  path: '/authorization/rules',
  grant: 'rule_admin'
},

{
  path: '/services',
  grant: 'se_admin'
},
{
  path: '/authentication',
  grant: 'key_admin'
}]

const log = new Microledger({ secretKey: 'secret', genesis, sgl, keyPair })
log.append({ services: [{ name: 'Sam' }, { name: 'Pepe' }], publicKey: [{ name: 'Sam' }, { name: 'Pepe' }] }).then((result) => {
  log.last().then((node) => {
    console.log(util.inspect(node.state, false, null, true))
  })
})

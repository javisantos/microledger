const Microledger = require('.')
const log = new Microledger({ genesis: { me: 'Javi' }, debug: true })
log.append({ wife: { name: 'Sam' } }).then((result) => {
  console.log('result', result)
  log.last().then((node) => {
    console.log(node)
  })
})

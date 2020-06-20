import raw from 'random-access-web'
import v1 from './v1'

export default class Microledger extends v1 {
  constructor (name, opts = {}) {
    super(function () {
      return raw()(name)
    }, opts)
  }
}

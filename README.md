# Microledger

![alt node](https://img.shields.io/badge/node->=10.16.0-brightgreen.svg)
![alt version](https://img.shields.io/npm/v/microledger)
![alt size](https://img.shields.io/bundlephobia/min/microledger)
![alt gzipped](https://img.shields.io/bundlephobia/minzip/microledger)

A single file ledger with crypto features for append only objects

## Why

I needed a way to store [Append Only Objects](https://www.npmjs.com/package/append-only-object) history, and i used other of my libraries ([Faythe](https://www.npmjs.com/package/faythe) to add some crypto and encoding features. The main idea is to have all the the data in only one file (Easy to store anywhere)

## Features

- Uses [random access storage](https://www.npmjs.com/package/random-access-storage) and works in memory, file and browser (automatically choose the fastest option)
- Can encrypt the content with a `secretKey`
- Can sign the `nodes` with a ed25519 keypair
- Can use [SGL](https://evernym.github.io/sgl/) to manage `authorization`
- Each node have the current state (append->state)


## Installation

Available through the 
[npm registry](http://npmjs.com/package/microledger). It can be installed using the 
[`npm`](https://docs.npmjs.com/getting-started/installing-npm-packages-locally)
or 
[`yarn`](https://yarnpkg.com/en/)
command line tools.

```sh
npm install microledger --save
```

## Usage

```js
import Microledger from 'microledger'

const log = new Microledger({ genesis: { me: 'Javi' }})
log.append({ wife: { name: 'Sam' } }).then((result) => {
  console.log('result', result)
  log.last().then((node) => {
    console.log(node)
  })
})

```

## API

### `new Microledger([filename],[options])`

This class creates an append only object, where you can only `append` and `"delete"`.

`filename` if is a string, a filename is created in node. In the browser uses chrome filesystem api, creates an idb database, or uses localstorage. Can send any random local storage implementation as a function. If filename doesn't exist, uses ram.

Note: I'm normally use `.mlg` extension `'./myledger.mlg'`

`options` includes:

``` js
{
  genesis: {}, // The initial object.
  keyPair: null, // set an object with publicKey and privateKey to sign the appended nodes.
  secretKey: null // set a secretKey to encrypt each node.
  sgl: null, // set an object to manage authorization (more info above)
  cache: 65536, // cache gets ands sets to improve performance
}
```

### `append(delta, [options])`

This method appends the delta to the previos status 
`AppendOnlyObject`.

`options` check [AppendOnlyObject](https://www.npmjs.com/package/append-only-object)

### `get(seq)`

Returns the node in the `seq` sequence/index. Number incremented on each append.

### `last()`

Returns the last node in the microledger.

### `verify(seq)`

Verifies the hash related with the previos node (verifies the signature if exist). Returns true or false.

### `verified()`

Verifies all the nodes from the beginning. Returns true or false.


## Tests

```sh
npm install
npm run test
```

### SGL (Simple Grant Language)

[SGL](https://evernym.github.io/sgl/) is a simple but flexible DSL for granting and testing privileges (authorization). It is like XACML but simpler and JSON-oriented. You can use it to write rules about who should be able to do what, and then to compare circumstances to the rules to enforce custom logic. This lets you create your own Role-Based Access Control mechanisms, as well as authorizations based on other criteria.

To add this functionality you need to pass an object to verify each append:

Example:
```js
sgl = [{
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
```

This verifies the grant privileges for each path

Your microledger genesis MUST have `publicKey` and `authorization` properties:

Example:
```js
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
```

See `sgl.js` for more information. (Example Note: keyPair uses [Faythe](https://www.npmjs.com/package/faythe) identity class,and is exposed by `Microledger.Identity`)

## Protocol

Microledger is created to allow manage appends only objects in one single file. The header of the file:

version 2 bytes | mode 2 bytes  | genesislength 8 bytes

and then sequencially:

CBOR(Node) | nodelength | CBOR(Node) | nodelength ... etc

`version` is 01

`mode` can be:

`00` no encryption | no signatures

`10` encryption | no signature

`01` no encryption | signature

`02` no encryption | signature and sgl

`12` encryption | signature and sgl


The length of each node is an `uint64be` 8 bytes representation of Buffer length.


## Dependencies

- [append-only-object](https://ghub.io/append-only-object): A way to append objects (deltas) to objects
- [buffer](https://ghub.io/buffer): Node.js Buffer API, for the browser
- [esm](https://ghub.io/esm): Tomorrow&#39;s ECMAScript modules today!
- [faythe](https://ghub.io/faythe): An easy crypto library to send messages using key encapsulation. A courier for Alice and Bob.
- [quick-lru](https://ghub.io/quick-lru): Simple “Least Recently Used” (LRU) cache
- [random-access-file](https://ghub.io/random-access-file): Continuous reading or writing to a file using random offsets and lengths
- [random-access-memory](https://ghub.io/random-access-memory): Exposes the same interface as random-access-file but instead of writing/reading data to a file it maintains it in memory
- [random-access-web](https://ghub.io/random-access-web): Chooses the fastest random access backend based on the user&#39;s browser
- [simple-grant-lang](https://ghub.io/simple-grant-lang): Simple Grant Language (SGL)
- [uint64be](https://ghub.io/uint64be): Encode / decode big endian unsigned 64 bit integers
- [util.promisify](https://ghub.io/util.promisify): Polyfill/shim for util.promisify in node versions &lt; v8

## Dev Dependencies

- [@rollup/plugin-commonjs](https://ghub.io/@rollup/plugin-commonjs): Convert CommonJS modules to ES2015
- [@rollup/plugin-replace](https://ghub.io/@rollup/plugin-replace): Replace strings in files while bundling
- [del-cli](https://ghub.io/del-cli): Delete files and directories - Cross-platform
- [eslint](https://ghub.io/eslint): An AST-based pattern checker for JavaScript.
- [eslint-config-standard](https://ghub.io/eslint-config-standard): JavaScript Standard Style - ESLint Shareable Config
- [eslint-plugin-import](https://ghub.io/eslint-plugin-import): Import with sanity.
- [eslint-plugin-node](https://ghub.io/eslint-plugin-node): Additional ESLint&#39;s rules for Node.js
- [eslint-plugin-promise](https://ghub.io/eslint-plugin-promise): Enforce best practices for JavaScript promises
- [eslint-plugin-standard](https://ghub.io/eslint-plugin-standard): ESlint Plugin for the Standard Linter
- [husky](https://ghub.io/husky): Prevents bad commit or push (git hooks, pre-commit/precommit, pre-push/prepush, post-merge/postmerge and all that stuff...)
- [nodemon](https://ghub.io/nodemon): Simple monitor script for use during development of a node.js app.
- [rollup](https://ghub.io/rollup): Next-generation ES module bundler
- [rollup-plugin-commonjs-alternate](https://ghub.io/rollup-plugin-commonjs-alternate): Alternative CommonJS Rollup plugin.
- [rollup-plugin-node-polyfills](https://ghub.io/rollup-plugin-node-polyfills): rollup-plugin-node-polyfills ===
- [rollup-plugin-node-resolve](https://ghub.io/rollup-plugin-node-resolve): Bundle third-party dependencies in node_modules
- [rollup-plugin-terser](https://ghub.io/rollup-plugin-terser): Rollup plugin to minify generated es bundle
- [tap-spec](https://ghub.io/tap-spec): Formatted TAP output like Mocha&#39;s spec reporter
- [tape](https://ghub.io/tape): tap-producing test harness for node and browsers


## License

MIT

Copyright (c) 2020 Javi Santos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

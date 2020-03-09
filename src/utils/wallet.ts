var CoinKey = require('coinkey')
var crypto = require('crypto')
const CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')
var cs = require('coinstring')

module Wallet {

    export class Lyra {
  
        public async createnewaddress(): Promise<Object> {
            return new Promise(response => {
                var ck = new CoinKey.createRandom(global['lyraInfo'])
                var lyrapub = ck.publicAddress;
                var lyraprv = ck.privateWif;
                var lyrakey = ck.publicKey.toString('hex');

                response({
                    address: lyrapub,
                    private_key: lyraprv,
                    pub_key: lyrakey
                })
            })
        }

        public async verifyMessage(pubkey, signature, message): Promise<Object>{
            return new Promise(async response => {
                //CREATE HASH FROM MESSAGE
                let hash = CryptoJS.SHA256(message);
                let msg = Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
                //VERIFY MESSAGE
                let buf = Buffer.from(signature,'hex')
                let pubKey = Buffer.from(pubkey,'hex')
                let verified = secp256k1.verify(msg, buf, pubKey)
                let address = await this.getAddressFromPubKey(pubkey)
                if(verified === true){
                    response({
                        address: address,
                        pubkey: pubkey,
                        signature: signature,
                        hash: hash.toString(CryptoJS.enc.Hex),
                        message: message,
                    })
                }else{
                    response(false)
                }
            })
        }

        public async getAddressFromPubKey(pubKey){
            return new Promise(response => {
                let pubkeybuffer = Buffer.from(pubKey,'hex')
                var sha = crypto.createHash('sha256').update(pubkeybuffer).digest()
                let pubKeyHash = crypto.createHash('rmd160').update(sha).digest()
                var hash160Buf = Buffer.from(pubKeyHash, 'hex')
                response(cs.encode(hash160Buf, global['lyraInfo'].public)) 
            })
        }

        public async send(method, params = []) {
            return new Promise(response => {
                response(true)
            })
        }

        public async balance(method, params = []) {
            return new Promise(response => {
                response(true)
            })
        }

    }

    export class Planum {
  
        public async send(method, params = []) {
            return new Promise(response => {
                response(true)
            })
        }

        public async balance(method, params = []) {
            return new Promise(response => {
                response(true)
            })
        }

    }

}

export = Wallet
let request = require("request")
let axios = require('axios')
import * as PouchDB from 'pouchdb'
PouchDB.plugin(require('pouchdb-find'))
import * as RPC from './rpc'
const crypto = require('crypto')

module Daemon {

    export class Status {
        mailgun: any
        constructor() {
            const api_key = process.env.MAILGUN_KEY;
            const domain = process.env.MAILGUN_DOMAIN;
            this.mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});
        }

        public async check() {
          return new Promise(async response => {
            var db = new PouchDB(global['db'])
            var idanode = new RPC.IdaNode
            let payments = await db.find({
                selector: {
                    $and: [
                        { status: {$ne: 'PAID'} },
                        { status: {$ne: 'EXPIRED'} }
                    ]
                }
            })
            for(let x in payments.docs){
                let doc = payments.docs[x]
                console.log('CHECKING ' + doc['address'].address)
                let expired = false
                if(doc['expiration'] > 0){
                    let now = Math.floor(Date.now() / 1000)
                    if(doc['expiration'] < now){
                        expired = true
                        db.get(doc['address'].address).then(function (expired) {
                            expired['status'] = 'EXPIRED';
                            db.put(expired);
                        })
                    }
                }

                if(expired === false){
                    let balance = await idanode.get('/balance/' + doc['address'].address)
                    if(parseFloat(balance['data'].balance) === parseFloat(doc['amount'])){
                        console.log('PAYMENT RECEIVED')
                        if(process.env.MAILTO !== undefined && doc['notified'] === undefined){
                            this.mailgun.messages().send({
                              from: 'Scrypta Gateway <'+ process.env.MAILFROM +'>',
                              to: process.env.MAILTO,
                              subject: 'Payment ' +  doc['address'].address + ' completed.',
                              html: 'You just received ' + doc['amount'] + ' ' + doc['asset'] + ' in your address.<br><br>Notes: ' + request.notes
                            })
                        }


                        var decipher = crypto.createDecipher('aes-256-cbc', process.env.SALT)
                        var dec = decipher.update(doc['address'].private_key,'hex','utf8')
                        dec += decipher.final('utf8')
                        let private_key = dec.replace(/"/g, '')
                        let sendSuccess = false

                        if(doc['asset'] === 'LYRA'){
                            let tosend = doc['amount'] - 0.001
                            console.log(JSON.stringify({
                                from: doc['address'].address,
                                to: process.env.COLD_ADDRESS,
                                amount: tosend,
                                private_key: private_key
                            }))
                            let send = await idanode.post('/send', {
                                from: doc['address'].address,
                                to: process.env.COLD_ADDRESS,
                                amount: tosend,
                                private_key: private_key
                            })
                            if(send['data'].data.success === true && send['data'].data.txid !== null && send['data'].data.txid !== undefined){
                                sendSuccess = true
                            }
                        }else{
                            // TODO: SEND ASSET
                        }

                        if(sendSuccess === true){
                            db.get(doc['address'].address).then(function (paid) {
                                paid['status'] = 'PAID'
                                paid['notified'] = true
                                db.put(paid);
                            })
                            console.log('PAYMENT UPDATED')
                        }else{
                            console.log('SOMETHING WRONG WITH SEND, BUT PAYMENT IS OK')
                        }
                    }
                }
            }
            response(true)
          })
      }

    }

}

export = Daemon
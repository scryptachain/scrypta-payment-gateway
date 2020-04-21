import { Injectable } from '@nestjs/common';
import * as RPC from '../../utils/rpc'
import * as Wallet from '../../utils/wallet'
import * as PouchDB from 'pouchdb';
import * as QRCode from 'qrcode'
const crypto = require('crypto')

@Injectable()
export class GatewayService {
  mailgun: any

  constructor() {
      const api_key = process.env.MAILGUN_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      this.mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});
  }

  async createRequest(request): Promise<Object> {
    var db = new PouchDB(global['db'])
   
    var wallet = new Wallet.Lyra;
    let address = await wallet.createnewaddress()

    const cipher = crypto.createCipher('aes-256-cbc', process.env.SALT)
    let private_key = cipher.update(JSON.stringify(address['private_key']), 'utf8', 'hex')
    private_key += cipher.final('hex')
    address['private_key'] = private_key
    let created = Math.floor(Date.now() / 1000)
    let expiration = created + 14400

    let paymentRequest = {
      _id: address['address'],
      address: address,
      amount: request.amount,
      expiration: expiration,
      asset: request.asset,
      notes: request.notes,
      created: created,
      notified: false,
      status: 'WAITING'
    }

    db.put(paymentRequest).catch(error => { console.log(error) })
    let qrcode = await QRCode.toDataURL(request.asset.toLowerCase() + ':' + address['address'] + '?amount=' + request.amount)
    
    if(process.env.MAILTO !== undefined){
      this.mailgun.messages().send({
        from: 'Scrypta Gateway <'+ process.env.MAILFROM +'>',
        to: process.env.MAILTO,
        subject: 'Gateway Request on ' + address['address'],
        html: 'Here\'s a new request from the Lyra Gateway:<br>' + address['address'] + '<br>Amount: ' + request.amount + ' ' + request.asset + '<br>Notes: ' + request.notes
      })
    }

    return {
      address: address['address'],
      expiration: expiration,
      asset: request.asset,
      amount: request.amount,
      qrcode: qrcode
    }
  }

  async checkRequest(request): Promise<Object> {
    var db = new PouchDB(global['db'])
    var idanode = new RPC.IdaNode

    let check = await db.get(request.address)
    if(check._id !== undefined){
      let balance
      if(check['asset'] === 'LYRA'){
        let balanceRequest = await idanode.get('/balance/' + request.address)
        balance = parseFloat(balanceRequest['data'].balance)
      }else{
        let balanceRequest = await idanode.post('/sidechain/balance',{
          dapp_address: request.address,
          sidechain_address: check['asset']
        })
        balance = parseFloat(balanceRequest['data'].balance)
      }

      if(balance === parseFloat(check['amount'])){
        db.get(request.address).then(function (doc) {
          doc['status'] = 'TRANSFER'
          db.put(doc);
        })

        return {
          message: 'Payment completed',
          balance: balance,
          expected: parseFloat(check['amount']),
          success: true
        }
      }else{
        return {
          message: 'Waiting for payment',
          balance: balance,
          expected: parseFloat(check['amount']),
          success: false
        }
      }
    }else{
      return {
        message: 'Payment not found',
        success: false
      }
    }
  }

  async validateRequest(request): Promise<Object> {
    var db = new PouchDB(global['db'])
    var idanode = new RPC.IdaNode
    let doc = await db.get(request.address)
    if(doc._id !== undefined){
      let balance
      if(doc['asset'] === 'LYRA'){
        let balanceRequest = await idanode.get('/balance/' + request.address)
        balance = parseFloat(balanceRequest['data'].balance)
      }else{
        let balanceRequest = await idanode.post('/sidechain/balance',{
          dapp_address: request.address,
          sidechain_address: doc['asset']
        })
        balance = parseFloat(balanceRequest['data'].balance)
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
          }).catch(err => {
              console.log('SENT FAILED')
              console.log(err)
          })
          if(send['data'].data.success === true && send['data'].data.txid !== null && send['data'].data.txid !== undefined){
              sendSuccess = true
          }
      }else{

        let balanceRequest = await idanode.get('/balance/' + doc['address'].address)
        let addressBalance = balanceRequest['data'].balance
        if(addressBalance === 0){
            let wallet = new RPC.Wallet
            let lyraRequest = await wallet.request('getinfo')
            if(lyraRequest['result'] !== undefined){
                let lyraBalance = lyraRequest['result']['balance']
                if(lyraBalance > 0.001){
                    console.log('SENDING 0.001 LYRA TO ' + doc['address'].address)
                    let sendRequest = await wallet.request('sendtoaddress', [doc['address'].address, 0.001])
                    if(sendRequest['result'].length === 64){
                        while(addressBalance === 0){
                            let balanceRequest = await idanode.get('/balance/' + doc['address'].address)
                            addressBalance = balanceRequest['data'].balance
                        }
                    }else{
                        console.log('0.001 LYRA SENDING FAILED')
                    }
                }else{
                    console.log("CAN'T SEND 0.001 LYRA")
                }
            }else{
                console.log("WALLET NOT CONNECTED, PLEASE CHECK!")
            }
        }
            
        if(addressBalance >= 0.001){
            let send = await idanode.post('/sidechain/send', {
                from: doc['address'].address,
                pubkey: doc['address'].pub_key,
                sidechain_address: doc['asset'],
                to: process.env.COLD_ADDRESS,
                amount: doc['amount'],
                private_key: private_key
            }).catch(err => {
                console.log('SENT FAILED')
                console.log(err)
            })
            if(send['data'].txs !== undefined){
                if(send['data'].txs[0].length === 64){
                    sendSuccess = true
                }
            }
        }
    }

    if(sendSuccess === true){
        if(process.env.MAILTO !== undefined && doc['notified'] === false){
            this.mailgun.messages().send({
            from: 'Scrypta Gateway <'+ process.env.MAILFROM +'>',
            to: process.env.MAILTO,
            subject: 'Payment ' +  doc['address'].address + ' completed.',
            html: 'You just received ' + doc['amount'] + ' ' + doc['asset'] + ' in your cold storage address.'
            })
        }

        db.get(doc['address'].address).then(function (paid) {
            paid['status'] = 'PAID'
            paid['notified'] = true
            db.put(paid);
        })

        console.log('PAYMENT UPDATED')

        return {
          message: 'Asset transferred',
          balance: balance,
          expected: parseFloat(doc['amount']),
          success: true
        }
      }else{
          console.log('SOMETHING WRONG WITH SEND, BUT PAYMENT IS OK')

          return {
            message: 'Can\'t transfer assets',
            balance: balance,
            expected: parseFloat(doc['amount']),
            success: false
          }
      }
    }else{
      return {
        message: 'Payment not found',
        success: false
      }
    }
  }
}

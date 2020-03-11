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
}

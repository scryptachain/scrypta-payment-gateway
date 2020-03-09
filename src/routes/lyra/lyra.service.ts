import { Injectable } from '@nestjs/common';
import * as RPC from '../../utils/rpc'
import * as Wallet from '../../utils/wallet'

@Injectable()
export class LyraService {
  constructor() {}

  async getInfo(): Promise<string> {
    var wallet = new RPC.Wallet;
    let request = await wallet.request('getinfo')
    if(request !== undefined){
      return request['result']
    }else{
      return JSON.stringify({
        message: 'Wallet not connected',
        success: false
      })
    }
  }

  async getNewAddress(): Promise<Object> {
    var wallet = new Wallet.Lyra;
    let address = await wallet.createnewaddress()
    return address
  }

  async getBalance(request): Promise<Number> {
    var idanode = new RPC.IdaNode;
    let balance = 0
    if(request.asset === 'LYRA'){
      let req = await idanode.get('/balance/' + request.address)
      balance = req['data']['balance']
    }else{
      let req = await idanode.post('/sidechain/balance', { dapp_address: request.address, sidechain_address: request.asset })
      balance = req['data']['balance']
    }
    return balance
  }
  
}

let request = require("request")
let axios = require('axios')

module RPC {

    const idanodes = ['https://idanodejs01.scryptachain.org']

    export class Wallet {
  
      public async request(method, params = []) {
          return new Promise(response => {
              var rpcport = process.env.RPCPORT
              if(process.env.TESTNET !== undefined && process.env.RPCPORT_TESTNET !== undefined){
                if(process.env.TESTNET === 'true'){
                  rpcport = process.env.RPCPORT_TESTNET
                }
              }
              var rpcuser = process.env.RPCUSER
              var rpcpassword = process.env.RPCPASSWORD
              var rpcendpoint = 'http://'+ process.env.RPCADDRESS +':' + rpcport
              if(process.env.DEBUG === "full"){
                  console.log('Connecting to ' + rpcendpoint + ' WITH ' +rpcuser+'/'+rpcpassword)
              }
              let req = {
                  url: rpcendpoint,
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Basic ' + Buffer.from(rpcuser + ":" + rpcpassword).toString("base64")
                  },
                  body: JSON.stringify({
                      id: Math.floor((Math.random() * 100000) + 1),
                      params: params,
                      method: method
                  })
              };
              request(req, function (err, res, body) {
                  try {
                      if(process.env.DEBUG === "full"){
                          console.log(body)
                      }
                      response(JSON.parse(body))
                  } catch (err) {
                      response(body)
                  }
              });
          })
      }

    }

    export class IdaNode {
        public async connect() {
            return new Promise(response => {
                var connected = false
                for(var i = 0; i < idanodes.length; i++){
                    axios.get(idanodes[i] + '/wallet/getinfo').then(check => {
                        if(check.data.blocks !== undefined && connected === false){
                            connected = true
                            response(check.config.url.replace('/wallet/getinfo',''))
                        }
                    })
                }
            })
        }

        public async post(method, params = {}) {
            return new Promise(async response => {
                let idanode = await this.connect()
                let res = await axios.post(idanode + method, params)
                response(res)
            })
        }
        
        public async get(method) {
            return new Promise(async response => {
                let idanode = await this.connect()
                let res = await axios.get(idanode + method)
                response(res)
            })
        }
    }

}

export = RPC
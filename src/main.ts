import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Daemon from './utils/daemon'
declare const module: any;

global['daemon'] = false
global['db'] = 'gateway'

if(process.env.TESTNET !== undefined){
  if(process.env.TESTNET === 'true'){
    // TESTNET BLOCKCHAIN PARAMS
    global['lyraInfo'] = {
      private: 0xae,
      public: 0x7f,
      scripthash: 0x13
    }
  }else{
    // MAINNET BLOCKCHAIN PARAMS
    global['lyraInfo'] = {
      private: 0xae,
      public: 0x30,
      scripthash: 0x0d
    }
  }
}else{
  // MAINNET BLOCKCHAIN PARAMS
  global['lyraInfo'] = {
    private: 0xae,
    public: 0x30,
    scripthash: 0x0d
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000);

  setInterval(async function(){
    if(global['daemon'] === false){
      global['daemon'] = true
      console.log('CHECKING ALL STATUSES')
      let daemon = new Daemon.Status
      await daemon.check()
      global['daemon'] = false
    }
  },10000)

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();

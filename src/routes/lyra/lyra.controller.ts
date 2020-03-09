import { Controller, Get, Body, Post } from '@nestjs/common'
import { LyraService } from './lyra.service'

@Controller('wallet')
export class LyraController {
  constructor(private readonly lyra: LyraService) {}

  @Get('getinfo')
  async getInfo(): Promise<string> {
    return await this.lyra.getInfo()
  }

  @Get('getnewaddress')
  async getNewAddress(): Promise<Object> {
    return await this.lyra.getNewAddress()
  }

  @Post('balance')
  async getBalance(@Body() request): Promise<Number> {
    return await this.lyra.getBalance(request)
  }
}
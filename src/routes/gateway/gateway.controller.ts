import { Controller, Get, Body, Post } from '@nestjs/common'
import { GatewayService } from './gateway.service'

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  @Post('request')
  async createRequest(@Body() request): Promise<Object> {
    return await this.gateway.createRequest(request)
  }

  @Post('check')
  async checkRequest(@Body() request): Promise<Object> {
    return await this.gateway.checkRequest(request)
  }

  @Post('validate')
  async validateRequest(@Body() request): Promise<Object> {
    return await this.gateway.validateRequest(request)
  }
}
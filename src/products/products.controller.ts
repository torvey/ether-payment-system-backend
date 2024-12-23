import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { UserRequest } from 'src/user/user.service';
import { CreateProductDto } from './dto/create-product.dto';
import { DeleteProductDto } from './dto/delete-product.dto';
import { UpdateProductDto } from './dto/edit-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Req() req: UserRequest,
    @Body()
    createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(createProductDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Post('generate-delete-code')
  async generateDeleteCode(@Req() req: UserRequest) {
    await this.productsService.generateCode(req.user.userId);

    return { message: 'Code generated' };
  }

  @Post('generate-edit-code')
  async generateEditCode(@Req() req: UserRequest) {
    await this.productsService.generateCode(req.user.userId);

    return { message: 'Code generated' };
  }

  @Patch(':id')
  async update(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body()
    { code, ...data }: UpdateProductDto,
  ) {
    if (await this.productsService.validateCode(req.user.userId, code)) {
      return this.productsService.update(+id, data);
    }

    throw new BadRequestException('Invalid code');
  }

  @Delete(':id')
  async remove(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() deleteProductDto: DeleteProductDto,
  ) {
    if (
      await this.productsService.validateCode(
        req.user.userId,
        deleteProductDto.code,
      )
    ) {
      return this.productsService.remove(+id);
    }

    throw new BadRequestException('Invalid code');
  }
}

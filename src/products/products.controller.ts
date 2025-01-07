import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequest } from 'src/user/user.service';
import { CreateProductDto } from './dto/create-product.dto';
import { DeleteProductDto } from './dto/delete-product.dto';
import { UpdateProductDto } from './dto/edit-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

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
    const { email, userId } = req.user;

    await this.productsService.generateCode(userId, email);

    return { message: 'Code generated' };
  }

  @Post('generate-edit-code')
  async generateEditCode(@Req() req: UserRequest) {
    const { email, userId } = req.user;

    await this.productsService.generateCode(userId, email);

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

  @Get(':id/transactions')
  async getProductTransactions(
    @Param('id') productId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: UserRequest,
  ) {
    const userId = req.user.userId;

    const product = await this.prisma.product.findUnique({
      where: { id: Number(productId) },
    });

    if (!product || product.userId !== userId) {
      throw new NotFoundException(`Product with ID ${productId} not found.`);
    }

    const transactions = await this.productsService.getProductTransactions(
      product,
      Number(page),
      Number(limit),
    );
    if (!transactions) {
      throw new NotFoundException(
        `No transactions found for product ID ${productId}`,
      );
    }
    return transactions;
  }
}

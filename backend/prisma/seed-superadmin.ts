import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'leongonvaz15@gmail.com'.toLowerCase();
  const nombre = 'León González Vázquez';
  const curp = 'GOVL961115HDFNZN03';
  const password = 'tontito';
  const pin = '5445';

  const yaExiste = await prisma.usuario.findFirst({
    where: { email },
  });

  if (yaExiste) {
    console.log('Ya existe un usuario con ese email, no se creó otro.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const pinHash = await bcrypt.hash(pin, 8);

  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email,
      passwordHash,
      pinHash,
      curp,
      isSuperAdmin: true,
    },
  });

  console.log('Superadmin creado con id:', usuario.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });


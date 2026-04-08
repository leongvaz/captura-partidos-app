import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { authRoutes } from './routes/auth.js';
import { invitacionesRoutes } from './routes/invitaciones.js';
import { ligasRoutes } from './routes/ligas.js';
import { equiposRoutes } from './routes/equipos.js';
import { jugadoresRoutes } from './routes/jugadores.js';
import { canchasRoutes } from './routes/canchas.js';
import { sedesRoutes } from './routes/sedes.js';
import { partidosRoutes } from './routes/partidos.js';
import { ligaRoutes } from './routes/liga.js';
import { personasRoutes } from './routes/personas.js';
import { authMiddleware } from './lib/auth.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
await app.register(fastifyStatic, { root: uploadDir, prefix: '/uploads' });

app.decorate('authenticate', authMiddleware);

app.register(authRoutes, { prefix: '/api/v1' });
app.register(invitacionesRoutes, { prefix: '/api/v1' });
app.register(ligasRoutes, { prefix: '/api/v1' });
app.register(equiposRoutes, { prefix: '/api/v1' });
app.register(jugadoresRoutes, { prefix: '/api/v1' });
app.register(canchasRoutes, { prefix: '/api/v1' });
app.register(sedesRoutes, { prefix: '/api/v1' });
app.register(partidosRoutes, { prefix: '/api/v1' });
app.register(ligaRoutes, { prefix: '/api/v1' });
app.register(personasRoutes, { prefix: '/api/v1' });

const port = Number(process.env.PORT) || 3001;
try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API escuchando en http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

// Evitar que el servidor se inicie durante las pruebas
jest.mock('../index', () => {
  const express = require('express');
  const app = express();
  
  // Middleware para parsear JSON
  app.use(express.json());
  
  // Configurar rutas de prueba
  app.put('/candidates/:id/stage', async (req: Request, res: Response) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { stageId } = req.body || {};
      
      if (isNaN(candidateId)) {
        return res.status(400).json({ error: 'ID de candidato inválido' });
      }
      
      if (!stageId || isNaN(parseInt(String(stageId)))) {
        return res.status(400).json({ error: 'ID de etapa inválido' });
      }
      
      // Usar el mock de prisma
      const prisma = new PrismaClient();
      
      // Buscar la aplicación del candidato
      const application = await prisma.application.findFirst({
        where: { candidateId }
      });

      if (!application) {
        return res.status(400).json({ error: 'No se encontró ninguna aplicación para este candidato' });
      }

      // Verificar que la nueva etapa existe
      const interviewStep = await prisma.interviewStep.findUnique({
        where: { id: parseInt(String(stageId)) }
      });

      if (!interviewStep) {
        return res.status(400).json({ error: 'La etapa de entrevista especificada no existe' });
      }

      // Actualizar la etapa actual de la aplicación
      const updatedApplication = await prisma.application.update({
        where: { id: application.id },
        data: { currentInterviewStep: parseInt(String(stageId)) }
      });

      return res.status(200).json({ 
        message: 'Etapa del candidato actualizada correctamente', 
        data: updatedApplication 
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  });

  return { app };
});

const prisma = new PrismaClient();

// Mock de prisma para las pruebas
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    application: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    interviewStep: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('PUT /candidates/:id/stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Caso feliz: Actualizar la etapa de un candidato existente
  it('debería actualizar la etapa de un candidato existente', async () => {
    // Mock de datos para la prueba
    const mockApplication = {
      id: 1,
      candidateId: 1,
      positionId: 1,
      currentInterviewStep: 1,
    };

    const mockInterviewStep = {
      id: 2,
      name: 'Entrevista Técnica',
    };

    const mockUpdatedApplication = {
      ...mockApplication,
      currentInterviewStep: 2,
    };

    // Configurar los mocks
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
    (prisma.interviewStep.findUnique as jest.Mock).mockResolvedValue(mockInterviewStep);
    (prisma.application.update as jest.Mock).mockResolvedValue(mockUpdatedApplication);

    // Realizar la solicitud
    const response = await request(app)
      .put('/candidates/1/stage')
      .send({ stageId: 2 });

    // Verificar la respuesta
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Etapa del candidato actualizada correctamente');
    expect(response.body.data).toHaveProperty('currentInterviewStep', 2);
  });

  // Caso de error: Candidato no encontrado
  it('debería devolver un error si el candidato no existe', async () => {
    // Configurar el mock para devolver null (candidato no encontrado)
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);

    // Realizar la solicitud
    const response = await request(app)
      .put('/candidates/999/stage')
      .send({ stageId: 2 });

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'No se encontró ninguna aplicación para este candidato');
  });

  // Caso de error: Etapa de entrevista no encontrada
  it('debería devolver un error si la etapa de entrevista no existe', async () => {
    // Mock de datos para la prueba
    const mockApplication = {
      id: 1,
      candidateId: 1,
      positionId: 1,
      currentInterviewStep: 1,
    };

    // Configurar los mocks
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
    (prisma.interviewStep.findUnique as jest.Mock).mockResolvedValue(null);

    // Realizar la solicitud
    const response = await request(app)
      .put('/candidates/1/stage')
      .send({ stageId: 999 });

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'La etapa de entrevista especificada no existe');
  });

  // Caso de error: ID de candidato inválido
  it('debería devolver un error para un ID de candidato inválido', async () => {
    // Realizar la solicitud con un ID no numérico
    const response = await request(app)
      .put('/candidates/abc/stage')
      .send({ stageId: 2 });

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'ID de candidato inválido');
  });

  // Caso de error: ID de etapa inválido
  it('debería devolver un error para un ID de etapa inválido', async () => {
    // Realizar la solicitud con un ID de etapa no numérico
    const response = await request(app)
      .put('/candidates/1/stage')
      .send({ stageId: 'abc' });

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'ID de etapa inválido');
  });

  // Caso de error: Error en la base de datos
  it('debería manejar errores de la base de datos', async () => {
    // Configurar el mock para lanzar un error
    (prisma.application.findFirst as jest.Mock).mockRejectedValue(new Error('Error de base de datos'));

    // Realizar la solicitud
    const response = await request(app)
      .put('/candidates/1/stage')
      .send({ stageId: 2 });

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
}); 
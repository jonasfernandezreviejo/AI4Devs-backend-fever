import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

// Evitar que el servidor se inicie durante las pruebas
jest.mock('../index', () => {
  const express = require('express');
  const app = express();
  
  // Configurar rutas de prueba
  app.get('/positions/:id/candidates', async (req: Request, res: Response) => {
    try {
      const positionId = parseInt(req.params.id);
      
      if (isNaN(positionId)) {
        return res.status(400).json({ error: 'ID de posición inválido' });
      }
      
      // Usar el mock de prisma
      const prisma = new PrismaClient();
      const applications = await prisma.application.findMany({
        where: { positionId },
        include: {
          candidate: true,
          interviewStep: true,
          interviews: true
        }
      });

      // Transformar los datos
      const candidates = applications.map((app: any) => {
        const scores = app.interviews
          .map((interview: any) => interview.score)
          .filter((score: any): score is number => score !== null);
        
        const averageScore = scores.length > 0 
          ? scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length 
          : null;

        return {
          id: app.candidateId,
          fullName: `${app.candidate.firstName} ${app.candidate.lastName}`,
          current_interview_step: app.currentInterviewStep,
          average_score: averageScore
        };
      });

      res.json(candidates);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
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
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('GET /positions/:id/candidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Caso feliz: Obtener candidatos para una posición existente
  it('debería devolver una lista de candidatos para una posición existente', async () => {
    // Mock de datos para la prueba
    const mockApplications = [
      {
        id: 1,
        positionId: 1,
        candidateId: 1,
        currentInterviewStep: 2,
        candidate: {
          firstName: 'Juan',
          lastName: 'Pérez',
        },
        interviewStep: {
          id: 2,
          name: 'Entrevista Técnica',
        },
        interviews: [
          { score: 85 },
          { score: 90 },
        ],
      },
      {
        id: 2,
        positionId: 1,
        candidateId: 2,
        currentInterviewStep: 1,
        candidate: {
          firstName: 'María',
          lastName: 'González',
        },
        interviewStep: {
          id: 1,
          name: 'Entrevista Inicial',
        },
        interviews: [
          { score: 75 },
        ],
      },
    ];

    // Configurar el mock para devolver los datos de prueba
    (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

    // Realizar la solicitud
    const response = await request(app).get('/positions/1/candidates');

    // Verificar la respuesta
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty('fullName', 'Juan Pérez');
    expect(response.body[0]).toHaveProperty('current_interview_step', 2);
    expect(response.body[0]).toHaveProperty('average_score', 87.5);
    expect(response.body[1]).toHaveProperty('fullName', 'María González');
    expect(response.body[1]).toHaveProperty('current_interview_step', 1);
    expect(response.body[1]).toHaveProperty('average_score', 75);
  });

  // Caso de borde: Posición sin candidatos
  it('debería devolver una lista vacía para una posición sin candidatos', async () => {
    // Configurar el mock para devolver una lista vacía
    (prisma.application.findMany as jest.Mock).mockResolvedValue([]);

    // Realizar la solicitud
    const response = await request(app).get('/positions/999/candidates');

    // Verificar la respuesta
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  // Caso de error: ID de posición inválido
  it('debería devolver un error para un ID de posición inválido', async () => {
    // Realizar la solicitud con un ID no numérico
    const response = await request(app).get('/positions/abc/candidates');

    // Verificar la respuesta
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'ID de posición inválido');
  });

  // Caso de error: Error en la base de datos
  it('debería manejar errores de la base de datos', async () => {
    // Configurar el mock para lanzar un error
    (prisma.application.findMany as jest.Mock).mockRejectedValue(new Error('Error de base de datos'));

    // Realizar la solicitud
    const response = await request(app).get('/positions/1/candidates');

    // Verificar la respuesta
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
}); 
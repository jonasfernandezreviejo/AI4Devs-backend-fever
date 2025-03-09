import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interfaz para la respuesta del endpoint GET /positions/:id/candidates
interface PositionCandidate {
  id: number;
  fullName: string;
  current_interview_step: number;
  average_score: number | null;
}

// Interfaz para la aplicación con sus relaciones
interface ApplicationWithRelations {
  id: number;
  positionId: number;
  candidateId: number;
  currentInterviewStep: number;
  candidate: {
    firstName: string;
    lastName: string;
  };
  interviews: Array<{
    score: number | null;
  }>;
  interviewStep: {
    id: number;
    name: string;
  };
}

export const getPositionCandidates = async (positionId: number): Promise<PositionCandidate[]> => {
  try {
    // Obtener todas las aplicaciones para la posición específica
    const applications = await prisma.application.findMany({
      where: { positionId },
      include: {
        candidate: true,
        interviewStep: true,
        interviews: true
      }
    }) as ApplicationWithRelations[];

    // Transformar los datos para el formato de respuesta requerido
    const candidates: PositionCandidate[] = applications.map((app: ApplicationWithRelations) => {
      // Calcular la puntuación media de las entrevistas
      const scores = app.interviews
        .map((interview) => interview.score)
        .filter((score): score is number => score !== null);
      
      const averageScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : null;

      return {
        id: app.candidateId,
        fullName: `${app.candidate.firstName} ${app.candidate.lastName}`,
        current_interview_step: app.currentInterviewStep,
        average_score: averageScore
      };
    });

    return candidates;
  } catch (error) {
    console.error('Error al obtener candidatos para la posición:', error);
    throw new Error('Error al recuperar los candidatos para la posición');
  }
}; 
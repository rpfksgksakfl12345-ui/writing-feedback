export type Role = "TEACHER" | "STUDENT";

export type SubmissionStatus = "PENDING" | "REVIEWED";
export type InputType = "TYPED" | "PHOTO";
export type OcrStatus = "NONE" | "PROCESSING" | "DONE" | "FAILED";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  grade: number | null;
  createdAt: string;
}

export interface Classroom {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  teacherId: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: number;
  userId: number;
  classroomId: number;
  studentNumber: number;
  classroomLoginPassword: string;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: number;
  title: string;
  description: string | null;
  grade: number;
  createdAt: string;
  teacherId: number;
  classroomId: number | null;
}

export interface Submission {
  id: number;
  inputType: InputType;
  imageUrl: string | null;
  content: string | null;
  ocrStatus: OcrStatus;
  ocrError: string | null;
  ocrExtractedText: string | null;
  editedExtractedText: string | null;
  extractedText: string | null;
  aiFeedback: string | null;
  finalFeedback: string | null;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  studentId: number;
  topicId: number;
  classroomId: number | null;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  active: boolean;
  wins: number;
  losses: number;
  rating: number;
  createdAt: string;
}

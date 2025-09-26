import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/services/authService";



export const useLogin = () => {
  return useMutation({ mutationFn: loginUser });
};
import { useMutation } from "@tanstack/react-query";
import { registerUser } from "@/services/authService";
import { optsend } from "@/services/authService"

export const useRegister = () => {
  return useMutation({ mutationFn: registerUser });
};


export const useOtpSend = () => {
  return useMutation({ mutationFn: (email) => optsend(email) });
};
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWord, updateWord, fetchWord, deleteWord } from "@/services/apiService";

export const useAddWord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: addWord,
        onSuccess: () => {
            queryClient.invalidateQueries(["word"]);
        },
    });
};

export const useUpdateWord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateWord,
        onSuccess: () => {
            queryClient.invalidateQueries(["word"]);
        },
    });
};

export const useFetchWord = () => {
    return useQuery({
        queryKey: ["word"],
        queryFn: fetchWord,
    });
};

export const useDeleteWord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteWord,
        onSuccess: () => {
            queryClient.invalidateQueries(["word"]);
        },
    });
}
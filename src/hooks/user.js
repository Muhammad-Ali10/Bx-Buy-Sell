import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers, deleteUser, getUser } from "@/services/userService";


export const useFetchUsers = () => {
    return useQuery({
        queryKey: ["user"],
        queryFn: getUsers,
    });
};

export const useDeleteUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries(["users"]);
        },
    });
}

export const useGetUser = (id) => {
    return useQuery({
        queryKey: ["user", id],
        queryFn: () => getUser(id),
    });
};  
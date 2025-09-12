import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import UserTables from "@/components/admin/users-table"

const Users = () => {
  return (
    <div className="w-full flex flex-col gap-10 relative">
      <div className="flex flex-row items-center justify-between">
        {/* Search Box */}
        <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
          <Search className="text-gray-500" />
          <Input
            type="text"
            placeholder="Search by name, phone, username or email ..."
            className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
          />
        </div>
      </div>
      <UserTables />
    </div>
  )
}
export default Users;
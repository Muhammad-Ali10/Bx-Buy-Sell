import { Button } from "@/components/ui/button"
import Link from "next/link"

const Stats = ({ title, number, url }) => {
    return (
        <div className="bg-white shadow rounded-lg p-6 flex flex-col items-start justify-between max-w-[316px] w-full gap-10 ">
            <p className="text-black text-sm font-abeezee opacity-70">{title}</p>
            <div className="flex items-center justify-between w-full">
                <span className="text-2xl font-lufga font-bold text-black">{number}</span>
                <Button className="bg-[#C6FE1F] hover:bg-lime-500 text-black font-medium px-10 py-4 rounded-[56px]" asChild>
                    <Link href={url}>View</Link>
                </Button>
            </div>
        </div>
    )
}


export default Stats


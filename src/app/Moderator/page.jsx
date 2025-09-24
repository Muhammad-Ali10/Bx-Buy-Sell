import Statistics from "@/components/admin/Statistics"
import ListingStatistics from "@/components/admin/listings-statistics"
import VisitorsStatistics from "@/components/admin/visitors-statistics"
import ListingOverview from "@/components/admin/listings-overview"
export default function Home() {
  return (

    <div className="flex flex-col items-center justify-center gap-10">
      <Statistics />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center w-full">
        <ListingStatistics />
        <VisitorsStatistics />
      </div>
      <ListingOverview />
    </div>

  )
}

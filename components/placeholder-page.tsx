interface PlaceholderPageProps {
  title: string
  description?: string
  week?: number
}

export function PlaceholderPage({ title, description, week }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {week && (
        <p className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
          Coming in Week {week}
        </p>
      )}
    </div>
  )
}

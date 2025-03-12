import { UrlImportForm } from '~/components/UrlImportForm'

export default function ImportPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Import Prompts & Rules</h1>
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
        <UrlImportForm />
      </div>
    </div>
  )
} 
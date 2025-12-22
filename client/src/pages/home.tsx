import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Replit Keeper Created</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            The project files for <strong>replit-keeper</strong> have been created in the <code>replit-keeper/</code> directory.
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2">
            <li>index.js</li>
            <li>package.json</li>
            <li>Dockerfile</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

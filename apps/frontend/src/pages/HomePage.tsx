import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

export function HomePage() {
  const { user } = useAuthStore();

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Welcome to CX DAM
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Digital Asset Management for Salesforce Documentation
      </p>

      <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Features</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li>✓ Upload and manage digital assets (images, videos, archives)</li>
              <li>✓ GitHub-based authentication and authorization</li>
              <li>✓ Search assets by name and tags</li>
              <li>✓ Repository-based workspace organization</li>
              <li>✓ Secure S3 storage with presigned URLs</li>
            </ul>
          </div>

          <div className="flex flex-col gap-4 mt-8">
            <Link
              to="/search"
              className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg font-medium hover:bg-blue-700"
            >
              Search Assets
            </Link>
            {user ? (
              <Link
                to="/upload"
                className="bg-green-600 text-white px-6 py-3 rounded-md text-lg font-medium hover:bg-green-700"
              >
                Upload Asset
              </Link>
            ) : (
              <p className="text-gray-600">
                Login with GitHub to upload assets
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { obtenerInfoRelease } from "@/lib/version";
import InfoReleaseChip from "@/components/InfoRelease";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  const infoRelease = obtenerInfoRelease();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl">
            <span className="text-[var(--primario)]">Tropicana</span>
          </h1>
          <p className="text-[var(--texto-tenue)] mt-2 text-lg">
            Escuela de Bailes — Gestión
          </p>
        </div>

        <LoginForm />

        <div className="flex justify-center mt-4">
          <InfoReleaseChip info={infoRelease} />
        </div>
      </div>
    </main>
  );
}

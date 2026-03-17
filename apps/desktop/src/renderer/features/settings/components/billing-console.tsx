import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Coins,
  CreditCard,
  Receipt,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { microAuToAu } from "@auria/domain";
import { useAuth } from "@/shared/hooks/use-auth";
import { useBillingConsole } from "../hooks/use-billing-console";

export const BillingConsole: React.FC = () => {
  const { status, user } = useAuth();
  const billing = useBillingConsole(user);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const currentWorkspace = billing.currentWorkspace;
  const currentWorkspaceSummary = billing.summary.workspaces.find(
    (workspace) => workspace.workspaceId === currentWorkspace?.id,
  );
  const currentSubscription =
    currentWorkspace?.subscription ?? billing.summary.currentSubscription;
  const currentOffer =
    billing.offers.find((offer) => offer.code === currentSubscription?.offerCode) ??
    billing.offers.find(
      (offer) =>
        offer.planCode === currentSubscription?.planCode &&
        offer.billingCycle === currentSubscription?.billingCycle,
    ) ??
    billing.summary.currentOffer;
  const currentAllocationMicro =
    currentWorkspaceSummary?.includedAuMonthlyMicro ??
    currentSubscription?.auIncludedMonthly ??
    billing.summary.currentAllocation?.monthlyMicro ??
    0;
  const currentWallet = billing.currentWallet;
  const visibleOffers = billing.offers.filter(
    (offer) => offer.billingCycle === selectedBillingCycle,
  );

  useEffect(() => {
    if (currentSubscription?.billingCycle) {
      setSelectedBillingCycle(currentSubscription.billingCycle);
    }
  }, [currentSubscription?.billingCycle]);

  const handleAction = async (
    action: Promise<{ message: string; url: string | null } | null>,
  ) => {
    try {
      const result = await action;
      if (!result) {
        setFeedback("Selecciona un espacio antes de iniciar una accion de facturacion.");
        return;
      }

      setFeedback(result.message);

      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo completar la accion de facturacion.",
      );
    }
  };

  if (status === "loading") {
    return <BillingPlaceholder label="Cargando consola de facturacion..." />;
  }

  if (status !== "authenticated") {
    return (
      <BillingPlaceholder label="Inicia sesion para acceder a suscripciones, paquetes AU y uso de facturacion." />
    );
  }

  return (
    <section className="space-y-8 md:space-y-10">
      <HeroBanner
        gatewayLabel={billing.gateway.publicLabel}
        gatewayMode={billing.gateway.mode}
        gatewayMessage={billing.gateway.message}
        workspaceName={currentWorkspace?.name ?? "Ningun espacio seleccionado"}
      />

      {feedback && <Notice tone="info">{feedback}</Notice>}
      {billing.error && <Notice tone="danger">{billing.error}</Notice>}
      {billing.gateway.mode !== "ready" && (
        <Notice tone="info">
          El modo simulacion esta activo. Iniciar un checkout aplica de inmediato el plan o
          paquete AU seleccionado mientras la pasarela de pago sigue pendiente.
        </Notice>
      )}
      {billing.summary.pendingCheckout && (
        <Notice tone="warning">
          Se detecto un checkout pendiente para{" "}
          <strong>{currentWorkspace?.name ?? billing.summary.pendingCheckout.workspaceId}</strong>.
          Estado actual: {formatReadableBillingValue(billing.summary.pendingCheckout.status)}.
        </Notice>
      )}

      {billing.workspaces.length > 0 && (
        <div className="space-y-4">
          <SectionEyebrow label="Contexto del espacio" />
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
            {billing.workspaces.map((workspace) => {
              const isActive = billing.currentWorkspaceId === workspace.id;

              return (
                <button
                  key={workspace.id}
                  onClick={() => billing.setCurrentWorkspaceId(workspace.id)}
                  className={`group rounded-[1.7rem] border px-5 py-4 text-left transition-all min-w-0 ${
                    isActive
                      ? "border-primary/40 bg-primary/10 shadow-[0_20px_60px_rgba(17,98,255,0.15)]"
                      : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                        {formatWorkspaceMode(workspace.mode)}
                      </div>
                      <div className="text-base font-black text-foreground break-words">
                        {workspace.name}
                      </div>
                    </div>
                    <div
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        isActive
                          ? "bg-primary text-white"
                          : "bg-background/60 text-muted-foreground"
                      }`}
                    >
                      {formatPlanLabel(workspace.subscription?.planCode ?? "free")}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                    <WorkspaceMicroStat
                      label="AU disponibles"
                      value={`${formatAu(
                        workspace.wallet
                          ? workspace.wallet.balanceMicro - workspace.wallet.reservedMicro
                          : 0,
                      )} AU`}
                    />
                    <WorkspaceMicroStat
                      label="Agentes"
                      value={`${workspace.subscription?.agentsSimultaneous ?? workspace.maxConcurrentAgents}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <MetricCard
          icon={<CreditCard className="w-4 h-4" />}
          eyebrow="Plan actual"
          value={
            currentSubscription
              ? formatPlanLabel(currentSubscription.planCode).toUpperCase()
              : "GRATIS"
          }
          note={
            currentSubscription
              ? `${formatBillingCycle(currentSubscription.billingCycle)} / ${formatReadableBillingValue(currentSubscription.status)}`
              : "Todavia no hay una suscripcion de pago conectada."
          }
          detail={`Oferta ${
            currentOffer?.code ??
            currentSubscription?.offerCode ??
            `${currentSubscription?.planCode ?? "free"}_${currentSubscription?.billingCycle ?? "monthly"}`
          }`}
        />
        <MetricCard
          icon={<Wallet className="w-4 h-4" />}
          eyebrow="Billetera AU"
          value={`${formatAu(
            currentWallet ? currentWallet.balanceMicro - currentWallet.reservedMicro : 0,
          )} AU`}
          note="Lista para nuevas ejecuciones."
          detail={`Reservado ${formatAu(currentWallet?.reservedMicro ?? 0)} AU`}
        />
        <MetricCard
          icon={<Boxes className="w-4 h-4" />}
          eyebrow="Capacidades"
          value={`${currentSubscription?.agentsSimultaneous ?? currentWorkspace?.maxConcurrentAgents ?? 1} agentes`}
          note={`${
            currentWorkspaceSummary?.maxRepositories ??
            currentSubscription?.maxRepositories ??
            1
          } repositorios disponibles`}
          detail={`${formatAu(currentAllocationMicro)} AU incluidos por ciclo`}
        />
        <MetricCard
          icon={<Shield className="w-4 h-4" />}
          eyebrow="Pasarela"
          value={billing.gateway.publicLabel}
          note={`${formatGatewayMode(billing.gateway.mode).toUpperCase()} / ${billing.gateway.configured ? "configurada" : "pendiente"}`}
          detail={billing.gateway.message}
        />
      </div>

      <div className="space-y-6">
        <Panel>
          <PanelHeader
            icon={<Zap className="w-4 h-4" />}
            title="Resumen del espacio"
            subtitle="Estado actual del espacio, reserva de AU y la accion de facturacion mas directa desde aqui."
          />

          {currentWorkspace ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatPill label="Espacio" value={currentWorkspace.name} />
                <StatPill
                  label="Estado del plan"
                  value={
                    currentSubscription
                      ? formatReadableBillingValue(currentSubscription.status)
                      : "gratis"
                  }
                />
                <StatPill
                  label="AU mensuales"
                  value={`${formatAu(currentAllocationMicro)} AU`}
                />
                <StatPill
                  label="Tope de presupuesto"
                  value={formatUsd(currentSubscription?.budgetLimitUsd ?? 0)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat
                  label="Acumulado ganado"
                  value={`${formatAu(currentWallet?.lifetimeEarned ?? 0)} AU`}
                />
                <MiniStat
                  label="Acumulado gastado"
                  value={`${formatAu(currentWallet?.lifetimeSpent ?? 0)} AU`}
                />
                <MiniStat
                  label="Acumulado reembolsado"
                  value={`${formatAu(currentWallet?.lifetimeRefund ?? 0)} AU`}
                />
              </div>

              <div className="rounded-[1.8rem] border border-primary/20 bg-primary/5 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  Movimiento recomendado
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {billing.summary.recommendedPack
                    ? `La reserva de la billetera es baja para el plan actual. La recarga mas natural es ${translatePackName(billing.summary.recommendedPack.name)}.`
                    : "El saldo actual de la billetera es suficiente. Puedes administrar la suscripcion o seguir operando con la reserva de AU existente."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <ActionButton
                  label="Administrar suscripcion"
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  onClick={() => void handleAction(billing.openBillingPortal())}
                  disabled={!currentWorkspace || billing.pendingAction === "portal"}
                  accent
                />
                {billing.summary.recommendedPack && (
                  <ActionButton
                    label={`${
                      billing.gateway.mode !== "ready" ? "Acreditar" : "Comprar"
                    } ${translatePackName(billing.summary.recommendedPack.name)}`}
                    icon={<Coins className="w-4 h-4" />}
                    onClick={() =>
                      void handleAction(
                        billing.beginPackCheckout(billing.summary.recommendedPack!.code),
                      )
                    }
                    disabled={!currentWorkspace || billing.pendingAction === "pack"}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyBlock label="Crea o selecciona un espacio para habilitar acciones de facturacion." />
          )}
        </Panel>

        <Panel>
          <PanelHeader
            icon={<CreditCard className="w-4 h-4" />}
            title="Catalogo de planes"
            subtitle="Cambia entre precios mensuales y anuales sin recorrer tarjetas duplicadas."
          />

          <div className="space-y-5">
            <CycleSwitcher
              value={selectedBillingCycle}
              onChange={setSelectedBillingCycle}
            />

            <div className="grid grid-cols-1 gap-4">
              {visibleOffers.map((offer) => {
                const isCurrent =
                  currentSubscription?.offerCode === offer.code ||
                  (currentSubscription?.planCode === offer.planCode &&
                    currentSubscription?.billingCycle === offer.billingCycle);

                return (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    simulationActive={billing.gateway.mode !== "ready"}
                    isCurrent={isCurrent}
                    disabled={!currentWorkspace || billing.pendingAction === "plan"}
                    onSelect={() => void handleAction(billing.beginPlanCheckout(offer.code))}
                  />
                );
              })}
            </div>

            {visibleOffers.length === 0 && (
              <EmptyBlock label="No hay planes disponibles para el ciclo de cobro seleccionado." compact />
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          icon={<Coins className="w-4 h-4" />}
          title="Paquetes AU"
          subtitle="Las recargas AU tambien usan una vista apilada para evitar tarjetas demasiado estrechas."
        />

        <div className="grid grid-cols-1 gap-4">
          {billing.packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              simulationActive={billing.gateway.mode !== "ready"}
              disabled={!currentWorkspace || billing.pendingAction === "pack"}
              onSelect={() => void handleAction(billing.beginPackCheckout(pack.code))}
            />
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<Receipt className="w-4 h-4" />}
          title="Actividad reciente"
          subtitle="Los eventos de cobro, el ciclo de checkout y los movimientos de la billetera AU se mantienen separados para auditoria."
        />

        <div className="grid grid-cols-1 gap-5">
          <LogList
            title="Eventos de facturacion"
            items={billing.events.map((event) => ({
              id: event.id,
              title: formatReadableBillingValue(event.eventType),
              meta: event.workspaceId ?? event.subscriptionId ?? "alcance de cuenta",
              aside:
                event.amountUsd === null
                  ? event.currency.toUpperCase()
                  : formatUsd(event.amountUsd),
            }))}
          />
          <LogList
            title="Transacciones AU"
            items={billing.transactions.map((transaction) => ({
              id: transaction.id,
              title: formatReadableBillingValue(transaction.transactionType),
              meta:
                transaction.description ||
                formatReadableBillingValue(transaction.referenceType || "wallet_movement"),
              aside: `${formatAu(transaction.amountMicro)} AU`,
            }))}
          />
        </div>
      </Panel>

      {billing.warnings.length > 0 && (
        <Panel>
          <PanelHeader
            icon={<Shield className="w-4 h-4" />}
            title="Alertas de integracion"
            subtitle="Los respaldos siguen activos donde el repositorio o el backend aun no exponen la ruta completa de facturacion."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {billing.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100 break-words"
              >
                {warning}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </section>
  );
};

function HeroBanner({
  gatewayLabel,
  gatewayMode,
  gatewayMessage,
  workspaceName,
}: {
  gatewayLabel: string;
  gatewayMode: string;
  gatewayMessage: string;
  workspaceName: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2.4rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(33,111,255,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6 md:p-7">
      <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] gap-6 items-start">
        <div className="min-w-0 space-y-4">
          <SectionEyebrow label="Capa de control comercial" />
          <div className="space-y-3">
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground break-words">
              La facturacion ya tiene una estructura real, sin forzar todavia la pasarela final.
            </h3>
            <p className="max-w-3xl text-sm md:text-[15px] leading-7 text-muted-foreground">
              Los planes, paquetes AU, sesiones de checkout, movimientos de billetera y eventos
              de facturacion ya estan conectados. Lo unico pendiente es el adaptador del
              proveedor y sus secretos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 min-w-0">
          <HeroInfoCard label="Espacio seleccionado" value={workspaceName} />
          <HeroInfoCard
            label="Estado de la pasarela"
            value={`${gatewayLabel} / ${formatGatewayMode(gatewayMode).toUpperCase()}`}
            note={gatewayMessage}
          />
        </div>
      </div>
    </div>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
      {label}
    </div>
  );
}

function HeroInfoCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border/60 bg-background/35 px-4 py-4 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">
        {label}
      </div>
      <div className="mt-2 text-base font-black text-foreground break-words leading-tight">
        {value}
      </div>
      {note ? (
        <p className="mt-2 text-xs leading-6 text-muted-foreground break-words">{note}</p>
      ) : null}
    </div>
  );
}

function BillingPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-[2.3rem] border border-border/60 bg-card/40 px-6 py-14 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-primary/30 bg-primary/10 text-foreground";

  return (
    <div className={`rounded-[1.7rem] border px-4 py-3 text-sm leading-6 break-words ${styles}`}>
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2.2rem] border border-border/60 bg-card/40 p-5 md:p-6 xl:p-7 space-y-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 p-2 rounded-2xl bg-primary/10 text-primary">{icon}</div>
        <h3 className="text-lg md:text-xl font-black tracking-[0.12em] uppercase break-words">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-6 text-muted-foreground break-words">{subtitle}</p>
    </div>
  );
}

function MetricCard({
  icon,
  eyebrow,
  value,
  note,
  detail,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  note: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.8rem] border border-border/60 bg-card/40 p-5 md:p-6 min-w-0 space-y-4">
      <div className="flex items-center gap-3 text-primary min-w-0">
        <div className="shrink-0 p-2 rounded-xl bg-primary/10">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground break-words">
          {eyebrow}
        </span>
      </div>
      <div className="text-[clamp(1.5rem,2.6vw,2.35rem)] font-black tracking-tight leading-none break-words">
        {value}
      </div>
      <p className="text-sm leading-6 text-muted-foreground break-words">{note}</p>
      <p className="text-xs leading-6 text-primary/85 break-words">{detail}</p>
    </div>
  );
}

function OfferCard({
  offer,
  simulationActive,
  isCurrent,
  disabled,
  onSelect,
}: {
  offer: {
    id: string;
    displayName: string;
    description: string;
    billingCycle: string;
    priceUsd: number | null;
    isCustomPrice: boolean;
    includedAuMonthly: number;
    budgetLimitUsd: number;
    planCode: string;
  };
  simulationActive: boolean;
  isCurrent: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-[2rem] border p-5 md:p-6 space-y-5 min-w-0 ${
        isCurrent
          ? "border-primary/40 bg-primary/8 shadow-[0_20px_60px_rgba(17,98,255,0.1)]"
          : "border-border/60 bg-card/30"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/85">
              {formatBillingCycle(offer.billingCycle)}
            </div>
            {isCurrent ? (
              <div className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                Actual
              </div>
            ) : null}
          </div>
          <h3 className="text-xl md:text-2xl font-black tracking-tight break-words">
            {translateOfferDisplayName(offer.displayName)}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground break-words">
            {translateOfferDescription(offer.description)}
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-border/50 bg-background/20 px-4 py-4 md:min-w-[220px]">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {simulationActive ? "Precio simulado" : "Precio"}
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight break-words">
            {offer.isCustomPrice ? "Personalizado" : formatUsd(offer.priceUsd ?? 0)}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {simulationActive
              ? "El checkout termina al instante en modo simulacion."
              : "Se cobra mediante la pasarela de pago seleccionada."}
          </div>
        </div>
      </div>

      <DetailList
        items={[
          { label: "Plan", value: formatPlanLabel(offer.planCode).toUpperCase() },
          { label: "AU incluidos", value: `${formatAu(offer.includedAuMonthly)} AU` },
          { label: "Tope de presupuesto", value: formatUsd(offer.budgetLimitUsd) },
          { label: "Ciclo de cobro", value: formatBillingCycle(offer.billingCycle) },
        ]}
      />

      <ActionButton
        label={
          isCurrent
            ? "Plan actual"
            : simulationActive
              ? "Activar en simulacion"
              : "Iniciar checkout"
        }
        onClick={onSelect}
        disabled={disabled || isCurrent}
      />
    </div>
  );
}

function PackCard({
  pack,
  simulationActive,
  disabled,
  onSelect,
}: {
  pack: {
    id: string;
    code: string;
    name: string;
    description: string;
    amountMicro: number;
    bonusMicro: number;
    priceUsd: number;
  };
  simulationActive: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-[2rem] border border-border/60 bg-card/30 p-5 md:p-6 space-y-5 min-w-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/85 break-all">
            {pack.code}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-black tracking-tight break-words">
              {translatePackName(pack.name)}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground break-words">
              {translatePackDescription(pack.description)}
            </p>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-border/50 bg-background/20 px-4 py-4 md:min-w-[220px]">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {simulationActive ? "Total simulado" : "Total"}
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight">
            {formatUsd(pack.priceUsd)}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {formatAu(pack.amountMicro + pack.bonusMicro)} AU acreditados al completarse.
          </div>
        </div>
      </div>

      <DetailList
        items={[
          { label: "AU base", value: `${formatAu(pack.amountMicro)} AU` },
          { label: "AU bono", value: `${formatAu(pack.bonusMicro)} AU` },
          {
            label: "Credito total",
            value: `${formatAu(pack.amountMicro + pack.bonusMicro)} AU`,
          },
        ]}
      />

      <ActionButton
        label={simulationActive ? "Acreditar en simulacion" : "Comprar paquete AU"}
        onClick={onSelect}
        disabled={disabled}
      />
    </div>
  );
}

function CycleSwitcher({
  value,
  onChange,
}: {
  value: "monthly" | "yearly";
  onChange: (value: "monthly" | "yearly") => void;
}) {
  return (
    <div className="inline-flex rounded-[1.4rem] border border-border/60 bg-background/25 p-1">
      <CycleButton
        active={value === "monthly"}
        label="Mensual"
        onClick={() => onChange("monthly")}
      />
      <CycleButton
        active={value === "yearly"}
        label="Anual"
        onClick={() => onChange("yearly")}
      />
    </div>
  );
}

function CycleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[1rem] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  accent = false,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 rounded-[1.4rem] px-4 py-3 text-center text-[11px] leading-5 font-black uppercase tracking-[0.18em] transition-all disabled:opacity-50 ${
        accent
          ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : "border border-border/60 bg-background/35 text-foreground hover:border-primary/35"
      }`}
    >
      {label}
      {icon}
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-border/60 px-4 py-4 bg-card/25 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-base font-black leading-tight break-words">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-border/50 bg-background/25 px-4 py-4 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground break-words">
        {label}
      </div>
      <div className="mt-2 text-sm md:text-base font-bold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function DetailList({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="divide-y divide-border/40 rounded-[1.4rem] border border-border/50 bg-background/20">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground break-words">
            {item.label}
          </div>
          <div className="text-sm md:text-base font-bold text-foreground break-words">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkspaceMicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-background/35 px-3 py-3 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold break-words">{value}</div>
    </div>
  );
}

function LogList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string; aside: string }>;
}) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/85">
        {title}
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyBlock label="Aun no hay actividad registrada." compact />
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-[1.5rem] border border-border/60 bg-background/20 px-4 py-4 min-w-0"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-bold capitalize break-words">{item.title}</div>
                  <div className="text-xs leading-6 text-muted-foreground break-words">
                    {item.meta}
                  </div>
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary break-words">
                  {item.aside}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyBlock({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-[1.6rem] border border-dashed border-border/60 bg-background/20 text-center text-muted-foreground ${
        compact ? "px-4 py-8 text-sm" : "px-6 py-12 text-sm"
      }`}
    >
      {label}
    </div>
  );
}

function formatAu(micro: number): string {
  return microAuToAu(micro).toFixed(2);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatPlanLabel(value: string): string {
  switch (value) {
    case "free":
      return "Gratis";
    case "starter":
      return "Inicial";
    case "pro":
      return "Pro";
    case "enterprise":
      return "Empresarial";
    default:
      return value;
  }
}

function formatBillingCycle(value: string): string {
  return value === "yearly" ? "Anual" : "Mensual";
}

function formatWorkspaceMode(value: string): string {
  switch (value) {
    case "cloud":
      return "Nube";
    case "hybrid":
      return "Hibrido";
    default:
      return "Local";
  }
}

function formatGatewayMode(value: string): string {
  switch (value) {
    case "ready":
      return "Listo";
    case "partial":
      return "Parcial";
    default:
      return "Simulacion";
  }
}

function formatReadableBillingValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  const exact: Record<string, string> = {
    active: "activa",
    trialing: "prueba",
    past_due: "pago atrasado",
    canceled: "cancelada",
    cancelled: "cancelada",
    paused: "pausada",
    unpaid: "impaga",
    pending: "pendiente",
    open: "abierta",
    completed: "completada",
    expired: "expirada",
    failed: "fallida",
    requires_gateway: "requiere pasarela",
    awaiting_payment: "esperando pago",
    paid: "pagada",
    credited: "acreditada",
    refunded: "reembolsada",
    initiated: "iniciada",
    wallet_movement: "movimiento de billetera",
  };

  if (exact[normalized]) {
    return exact[normalized];
  }

  const parts = normalized.split(/[_\s]+/);
  const words: Record<string, string> = {
    account: "cuenta",
    active: "activa",
    au: "AU",
    billing: "facturacion",
    checkout: "checkout",
    completed: "completada",
    credit: "credito",
    debit: "debito",
    event: "evento",
    events: "eventos",
    expired: "expirada",
    failed: "fallida",
    gateway: "pasarela",
    movement: "movimiento",
    open: "abierta",
    paid: "pagada",
    pack: "paquete",
    payment: "pago",
    pending: "pendiente",
    refund: "reembolso",
    refunded: "reembolsada",
    requires: "requiere",
    session: "sesion",
    subscription: "suscripcion",
    transaction: "transaccion",
    trialing: "prueba",
    wallet: "billetera",
  };

  return parts
    .map((part) => words[part] ?? part)
    .join(" ");
}

function translateOfferDisplayName(value: string): string {
  switch (value) {
    case "Free":
      return "Gratis";
    case "Starter":
      return "Inicial";
    case "Starter Annual":
      return "Inicial Anual";
    case "Enterprise":
      return "Empresarial";
    case "Pro Annual":
      return "Pro Anual";
    case "Enterprise Annual":
      return "Empresarial Anual";
    default:
      return value;
  }
}

function translateOfferDescription(value: string): string {
  const translations: Record<string, string> = {
    "Controlled entry plan for evaluation workspaces and low-risk activity.":
      "Plan de entrada controlado para espacios de evaluacion y actividad de bajo riesgo.",
    "Operational starter plan with moderate concurrency and useful monthly AU.":
      "Plan inicial operativo con concurrencia moderada y AU mensuales utiles.",
    "Starter plan billed yearly with the same monthly AU envelope.":
      "Plan Inicial facturado anualmente con la misma bolsa mensual de AU.",
    "Higher concurrency, premium tools and larger AU runway for sustained execution.":
      "Mayor concurrencia, herramientas premium y una reserva mas amplia de AU para ejecucion sostenida.",
    "Yearly Pro plan with the same monthly operational envelope.":
      "Plan Pro anual con la misma bolsa operativa mensual.",
    "Custom enterprise plan with expanded concurrency, governance and support.":
      "Plan empresarial personalizado con concurrencia ampliada, gobernanza y soporte.",
    "Custom enterprise agreement with annual billing.":
      "Acuerdo empresarial personalizado con facturacion anual.",
  };

  return translations[value] ?? value;
}

function translatePackName(value: string): string {
  const translations: Record<string, string> = {
    "AU Boost 10": "Impulso AU 10",
    "AU Boost 30": "Impulso AU 30",
    "AU Boost 80": "Impulso AU 80",
  };

  return translations[value] ?? value;
}

function translatePackDescription(value: string): string {
  const translations: Record<string, string> = {
    "Top-up pack for a small burst of autonomous execution.":
      "Paquete de recarga para una rafaga corta de ejecucion autonoma.",
    "Balanced AU refill with a small bonus for sustained work.":
      "Recarga equilibrada de AU con un pequeno bono para trabajo sostenido.",
    "Large AU refill intended for heavy execution windows.":
      "Recarga amplia de AU pensada para ventanas de ejecucion intensiva.",
  };

  return translations[value] ?? value;
}

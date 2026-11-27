import { useAction, useNavigate } from "@solidjs/router";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import Trash from "~/components/icons/trash";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Button } from "~/components/ui/input/button";
import { Checkbox } from "~/components/ui/input/checkbox";
import { Input } from "~/components/ui/input/input";
import { SearchInput } from "~/components/ui/input/search-input";
import { Select } from "~/components/ui/input/select";
import { Textarea } from "~/components/ui/input/textarea";
import { actionErrorMessage } from "~/contracts/errors";
import {
  isHostedVideoProvider,
  MEETING_VIDEO_PROVIDERS,
  type MeetingDetailView,
  type MeetingGuestView,
  type MeetingVideoProvider,
} from "~/contracts/meetings/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import {
  appDateTimeInputValue,
  appInstantFromInput,
} from "~/domain/time/app-time";
import {
  cancelMeetingMutation,
  createMeetingMutation,
  updateMeetingMutation,
} from "~/features/meetings/data/mutations";
import { VIDEO_PROVIDER_LABELS } from "~/features/meetings/video-provider";
import {
  meetingGuestOptionsQuery,
  meetingQuery,
  meetingVideoOptionsQuery,
} from "~/rpc/meetings/queries";

import { SidePanelPage } from "../../components/page";
import { SidePanelFooter } from "../../components/panel-footer";
import { useSidePanelPageState } from "../../router/page-state";
import { useSidePanel } from "../../state/use-side-panel";

import styles from "./page.module.css";

const HOUR_MS = 60 * 60_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MeetingFormPage() {
  const pageState = useSidePanelPageState("meeting-form");

  return (
    <Loading fallback={<Skeleton height={320} />}>
      <Show
        when={pageState().meetingId}
        fallback={
          <MeetingForm
            meeting={null}
            organizationId={pageState().organizationId}
            caseId={pageState().caseId}
            subject={pageState().subject}
          />
        }
      >
        {(meetingId) => <EditMeeting meetingId={meetingId()} />}
      </Show>
    </Loading>
  );
}

function EditMeeting(props: { meetingId: string }) {
  const meeting = createMemo(() => meetingQuery(props.meetingId));

  // MeetingForm seeds its signals from props once, so it must not mount
  // before the meeting has loaded.
  return (
    <Show when={meeting()}>
      {(loaded) => (
        <MeetingForm
          meeting={loaded()}
          organizationId={loaded().organizationId}
          caseId={loaded().caseId}
          subject={null}
        />
      )}
    </Show>
  );
}

// The next full hour, so a new meeting starts at a round time.
function defaultStart(): number {
  return Math.ceil(Date.now() / HOUR_MS) * HOUR_MS;
}

function MeetingForm(props: {
  meeting: MeetingDetailView | null;
  organizationId: string | null;
  caseId: string | null;
  subject: string | null;
}) {
  const create = useAction(createMeetingMutation);
  const update = useAction(updateMeetingMutation);
  const cancel = useAction(cancelMeetingMutation);
  const navigate = useNavigate();
  const { closePanel } = useSidePanel();
  const { currentUser } = useAuthenticatedSession();
  const options = createMemo(() =>
    meetingGuestOptionsQuery(props.organizationId),
  );
  const videoOptions = createMemo(() => meetingVideoOptionsQuery());
  // Zoom and Meet are offered to members who may host rooms; a saved meeting
  // still lists its own provider.
  const offeredProviders = () =>
    MEETING_VIDEO_PROVIDERS.filter(
      (provider) =>
        !isHostedVideoProvider(provider) ||
        hasPermission(currentUser(), "meeting:video:host") ||
        provider === props.meeting?.videoProvider,
    );

  const start = props.meeting?.startsAt ?? defaultStart();
  const [title, setTitle] = createSignal(
    props.meeting?.title ?? props.subject ?? "",
  );
  const [startsAt, setStartsAt] = createSignal(appDateTimeInputValue(start));
  const [endsAt, setEndsAt] = createSignal(
    appDateTimeInputValue(props.meeting?.endsAt ?? start + HOUR_MS),
  );
  const [location, setLocation] = createSignal(props.meeting?.location ?? "");
  const [videoProvider, setVideoProvider] = createSignal<MeetingVideoProvider>(
    props.meeting?.videoProvider ?? "none",
  );
  // A hosted provider's link is its own; only a pasted link is edited here.
  const [videoLink, setVideoLink] = createSignal(
    props.meeting?.videoProvider === "link"
      ? (props.meeting.videoLink ?? "")
      : "",
  );
  const [description, setDescription] = createSignal(
    props.meeting?.description ?? "",
  );
  const [guests, setGuests] = createSignal<MeetingGuestView[]>(
    (props.meeting?.guests ?? [])
      .filter((guest) => guest.memberUserId !== currentUser().id)
      .map((guest) => ({
        email: guest.email,
        name: guest.name,
        memberUserId: guest.memberUserId,
      })),
  );
  const [filter, setFilter] = createSignal("");
  const [extraEmail, setExtraEmail] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const selected = createMemo(
    () => new Set(guests().map((guest) => guest.email.toLowerCase())),
  );
  // Options not offered by the query (an added address, or a guest kept from
  // an earlier save) still show so they can be removed.
  const shownOptions = createMemo(() => {
    const offered = options().filter(
      (option) => option.memberUserId !== currentUser().id,
    );
    const offeredEmails = new Set(
      offered.map((option) => option.email.toLowerCase()),
    );
    const extra = guests()
      .filter((guest) => !offeredEmails.has(guest.email.toLowerCase()))
      .map((guest) => ({
        email: guest.email,
        name: guest.name ?? guest.email,
        memberUserId: guest.memberUserId,
      }));
    const needle = filter().trim().toLowerCase();
    return [...extra, ...offered].filter(
      (option) =>
        !needle ||
        option.name.toLowerCase().includes(needle) ||
        option.email.toLowerCase().includes(needle),
    );
  });

  function toggle(guest: MeetingGuestView, on: boolean): void {
    const email = guest.email.toLowerCase();
    setGuests((current) =>
      on
        ? [...current, guest]
        : current.filter((item) => item.email.toLowerCase() !== email),
    );
  }

  function addExtraEmail(): void {
    const email = extraEmail().trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError("Escribe un correo válido.");
      return;
    }
    setError(undefined);
    if (!selected().has(email.toLowerCase())) {
      toggle({ email, name: null, memberUserId: null }, true);
    }
    setExtraEmail("");
  }

  async function submit(): Promise<void> {
    const startInstant = appInstantFromInput(startsAt());
    const endInstant = appInstantFromInput(endsAt());
    if (!title().trim()) {
      setError("Escribe el título de la reunión.");
      return;
    }
    if (!startInstant || !endInstant) {
      setError("Indica el inicio y el fin.");
      return;
    }
    setBusy(true);
    setError(undefined);
    const input = {
      title: title().trim(),
      description: description().trim(),
      startsAt: startInstant.getTime(),
      endsAt: endInstant.getTime(),
      location: location().trim() || null,
      videoProvider: videoProvider(),
      videoLink: videoProvider() === "link" ? videoLink().trim() || null : null,
      organizationId: props.organizationId,
      caseId: props.caseId,
      guests: guests(),
    };
    try {
      const result = props.meeting
        ? await update({ ...input, meetingId: props.meeting.id })
        : await create(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      closePanel();
      navigate(`/meetings/${result.value.meetingId}`);
    } catch (caught: unknown) {
      setError(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function cancelMeeting(meetingId: string): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const result = await cancel(meetingId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      closePanel();
    } catch (caught: unknown) {
      setError(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const canceled = () => props.meeting?.status === "canceled";
  const footerOptions = () => {
    const meeting = props.meeting;
    if (!meeting || canceled()) return undefined;
    return [
      {
        id: "cancel-meeting",
        label: "Cancelar reunión",
        icon: Trash,
        danger: true,
        disabled: busy(),
        onSelect: () => void cancelMeeting(meeting.id),
      },
    ];
  };

  return (
    <SidePanelPage
      footer={
        <SidePanelFooter
          primary={{
            label: props.meeting ? "Guardar y avisar" : "Agendar y enviar",
            shortcut: "⏎",
            onClick: () => void submit(),
            disabled: busy() || canceled(),
          }}
          options={footerOptions()}
        />
      }
    >
      <form
        class={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label="Título"
          required
          value={title()}
          disabled={busy()}
          onInput={(event) => setTitle(event.currentTarget.value)}
        />
        <div class={styles.row}>
          <Input
            label="Inicio"
            type="datetime-local"
            required
            value={startsAt()}
            disabled={busy()}
            onInput={(event) => setStartsAt(event.currentTarget.value)}
          />
          <Input
            label="Fin"
            type="datetime-local"
            required
            value={endsAt()}
            disabled={busy()}
            onInput={(event) => setEndsAt(event.currentTarget.value)}
          />
        </div>
        <Select
          label="Videollamada"
          value={videoProvider()}
          disabled={busy()}
          onInput={(event) => {
            const picked = MEETING_VIDEO_PROVIDERS.find(
              (provider) => provider === event.currentTarget.value,
            );
            if (picked) setVideoProvider(picked);
          }}
        >
          <For each={offeredProviders()}>
            {(provider) => {
              // A saved meeting keeps its provider even after a disconnect,
              // so the form never silently switches it.
              const unavailable = () =>
                isHostedVideoProvider(provider) &&
                provider !== props.meeting?.videoProvider &&
                !videoOptions().available.includes(provider);
              return (
                <option value={provider} disabled={unavailable()}>
                  {VIDEO_PROVIDER_LABELS[provider]}
                  {unavailable() ? " (no conectado)" : ""}
                </option>
              );
            }}
          </For>
        </Select>
        <Show when={videoProvider() === "link"}>
          <Input
            label="Enlace de videollamada"
            type="url"
            required
            placeholder="https://…"
            value={videoLink()}
            disabled={busy()}
            onInput={(event) => setVideoLink(event.currentTarget.value)}
          />
        </Show>
        <Show when={isHostedVideoProvider(videoProvider())}>
          <p class={styles.meta}>
            {props.meeting?.videoProvider === videoProvider()
              ? "La sala se actualiza al guardar y conserva su enlace."
              : `La sala de ${VIDEO_PROVIDER_LABELS[videoProvider()]} se crea al guardar y su enlace va en la invitación.`}
          </p>
        </Show>
        <Input
          label="Lugar"
          value={location()}
          disabled={busy()}
          onInput={(event) => setLocation(event.currentTarget.value)}
        />
        <Textarea
          label="Descripción"
          rows={3}
          value={description()}
          disabled={busy()}
          onInput={(event) => setDescription(event.currentTarget.value)}
        />

        <section class={styles.guests} aria-label="Invitados">
          <header class={styles.guestsHeader}>
            <span class={styles.title}>Invitados</span>
            <span class={styles.meta}>
              {guests().length} seleccionados · tú vas como organizador
            </span>
          </header>
          <SearchInput
            placeholder="Buscar persona"
            value={filter()}
            onValueChange={setFilter}
          />
          <ul class={styles.guestList}>
            <For each={shownOptions()}>
              {(option) => (
                <li class={styles.guestItem}>
                  <Checkbox
                    label={option.name}
                    checked={selected().has(option.email.toLowerCase())}
                    disabled={busy()}
                    onChange={(event) =>
                      toggle(
                        {
                          email: option.email,
                          name: option.name,
                          memberUserId: option.memberUserId,
                        },
                        event.currentTarget.checked,
                      )
                    }
                  />
                  <span class={styles.meta}>
                    {option.memberUserId ? "Equipo" : "Contacto"} ·{" "}
                    {option.email}
                  </span>
                </li>
              )}
            </For>
          </ul>
          <div class={styles.addRow}>
            <Input
              type="email"
              placeholder="otro@correo.com"
              aria-label="Invitar otro correo"
              value={extraEmail()}
              disabled={busy()}
              onInput={(event) => setExtraEmail(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addExtraEmail();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy()}
              onClick={addExtraEmail}
            >
              Añadir
            </Button>
          </div>
        </section>

        <Show when={error()}>
          {(message) => (
            <p class={styles.error} role="alert">
              {message()}
            </p>
          )}
        </Show>
      </form>
    </SidePanelPage>
  );
}

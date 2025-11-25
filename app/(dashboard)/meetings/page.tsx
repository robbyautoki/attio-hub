"use client";

import { useState, useEffect } from "react";
import {
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  MailIcon,
  BellIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Booking {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  startTime: string;
  endTime: string | null;
  meetingLink: string | null;
  eventType: string | null;
  status: string | null;
  confirmationSentAt: string | null;
  reminder24hSentAt: string | null;
  reminder1hSentAt: string | null;
  createdAt: string;
}

export default function MeetingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500">Bestätigt</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Abgesagt</Badge>;
      case "completed":
        return <Badge variant="secondary">Abgeschlossen</Badge>;
      default:
        return <Badge variant="outline">{status || "Unbekannt"}</Badge>;
    }
  }

  function getReminderIcon(sentAt: string | null, label: string) {
    if (sentAt) {
      return (
        <span title={`${label} gesendet: ${new Date(sentAt).toLocaleString("de-DE")}`}>
          <CheckCircleIcon className="size-4 text-green-500" />
        </span>
      );
    }
    return (
      <span title={`${label} ausstehend`}>
        <ClockIcon className="size-4 text-muted-foreground" />
      </span>
    );
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }

  function isUpcoming(dateString: string) {
    return new Date(dateString) > new Date();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort bookings: upcoming first, then by date
  const sortedBookings = [...bookings].sort((a, b) => {
    const aUpcoming = isUpcoming(a.startTime);
    const bUpcoming = isUpcoming(b.startTime);
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meetings</h1>
        <p className="text-muted-foreground">
          Alle gebuchten Termine im Überblick
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Noch keine Buchungen vorhanden
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Gebuchte Termine ({bookings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const { date, time } = formatDateTime(booking.startTime);
                const upcoming = isUpcoming(booking.startTime);
                const fullName = [booking.firstName, booking.lastName]
                  .filter(Boolean)
                  .join(" ") || "Unbekannt";

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      upcoming ? "bg-muted/30" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Name and Status */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{fullName}</span>
                          {getStatusBadge(booking.status)}
                          {upcoming && (
                            <Badge variant="outline" className="text-xs">
                              Bevorstehend
                            </Badge>
                          )}
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <MailIcon className="size-3" />
                          <span className="truncate">{booking.email}</span>
                        </div>

                        {/* Date and Time */}
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <CalendarIcon className="size-4 text-primary" />
                          <span className="font-medium">{date}</span>
                          <span className="text-muted-foreground">um</span>
                          <span className="font-medium">{time} Uhr</span>
                        </div>

                        {/* Event Type and Meeting Link */}
                        <div className="flex items-center gap-4 text-sm">
                          {booking.eventType && (
                            <span className="text-muted-foreground">
                              {booking.eventType}
                            </span>
                          )}
                          {booking.meetingLink && (
                            <a
                              href={booking.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLinkIcon className="size-3" />
                              Meeting-Link
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Reminder Status */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BellIcon className="size-3" />
                          <span>Reminder</span>
                        </div>
                        <div className="flex items-center gap-2" title="Bestätigung, 24h, 1h">
                          {getReminderIcon(booking.confirmationSentAt, "Bestätigung")}
                          {getReminderIcon(booking.reminder24hSentAt, "24h Reminder")}
                          {getReminderIcon(booking.reminder1hSentAt, "1h Reminder")}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {booking.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

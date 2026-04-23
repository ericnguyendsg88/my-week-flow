import { DayColumn } from "./DayColumn";
import { CalEvent, Tag } from "@/types/event";
import { format } from "date-fns";

interface Props {
  weekDates: Date[];
  events: CalEvent[];
  tags: Tag[];
  pickMode: boolean;
  selectedDayKey: string;
  onPickSlot: (date: string, start: number) => void;
  onFocusDay: (key: string) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm

export function WeekGrid({ weekDates, events, tags }: Props) {
  return (
    <div style={{
      display: "flex",
      height: "100%",
      width: "100%",
      overflowY: "auto",
      overflowX: "auto",
      paddingRight: 24,
    }} className="scrollbar-hidden">
      
      {/* Global Time Gutter */}
      <div style={{ width: 40, flexShrink: 0, position: "relative", paddingTop: 80 }}>
        {HOURS.map((h) => (
          <div key={h} style={{
            position: "absolute",
            top: 80 + (h - 7) * 60,
            width: "100%",
            textAlign: "right",
            paddingRight: 8,
            fontSize: 12,
            color: "#888580",
            transform: "translateY(-50%)"
          }}>
            {h > 12 ? `${h - 12}p` : `${h}a`}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 80 + 15 * 60 }}>
        {weekDates.slice(0, 5).map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayEvents = events.filter((e) => e.date === dateStr);
          return (
            <DayColumn
              key={dateStr}
              date={date}
              events={dayEvents}
              tags={tags}
            />
          );
        })}
        
        {/* Weekend cards */}
        <div style={{ display: "flex", gap: 12 }}>
          {weekDates.slice(5).map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const dayEvents = events.filter((e) => e.date === dateStr);
            return (
              <DayColumn
                key={dateStr}
                date={date}
                events={dayEvents}
                tags={tags}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

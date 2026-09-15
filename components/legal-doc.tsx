import { SectionTitle } from "@/components/ui";

export type LegalSection = { h: string; p?: string[]; ul?: string[] };

export function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <section className="py-14">
      <div className="container-x">
        <SectionTitle align="left" eyebrow={`最后更新：${updated}`} title={title} desc={intro} />
        <div className="mx-auto mt-10 max-w-3xl space-y-9">
          {sections.map((s, i) => (
            <div key={s.h}>
              <h2 className="text-[17px] font-bold">
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {s.h}
              </h2>
              {s.p?.map((p, k) => (
                <p key={k} className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.ul ? (
                <ul className="mt-2.5 space-y-1.5">
                  {s.ul.map((u) => (
                    <li key={u} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wise-green" />
                      {u}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

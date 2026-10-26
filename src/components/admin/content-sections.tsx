/** بخش‌های سربرگ‌های پنل محتوا — فهرست + فرم ساخت/ویرایش، همه سمت سرور */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatJalaliFromIso,
  formatJalaliISO,
  gregorianToJalali,
  jalaliLabelFromIso,
  toPersianDigits,
} from '@/lib/jalali';
import { formatBytes } from '@/server/storage';
import {
  OCCASION_LABELS,
  PROGRAM_KIND_LABELS,
  adminAlbumOptions,
  adminAlbums,
  adminArticles,
  adminAudios,
  adminCategoryOptions,
  adminPhotoOptions,
  adminPersons,
  adminPrograms,
  adminVideos,
  fileUrl,
  getAlbumWithPhotos,
  tagList,
  type AlbumRow,
  type ArticleCard,
  type AudioRow,
  type PersonRow,
  type PhotoRow,
  type VideoRow,
} from '@/server/content';
import {
  saveAlbumAction,
  saveArticleAction,
  saveAudioAction,
  saveCategoryAction,
  savePersonAction,
  savePhotoAction,
  saveProgramAction,
  saveVideoAction,
} from '@/server/content-actions';
import { ContentForm, type FieldSpec } from './content-form';
import { DeleteButton, PublishToggle } from './row-actions';

const TAB = '/admin/content?tab=';

const occasionOptions = Object.entries(OCCASION_LABELS).map(([value, label]) => ({ value, label }));
const programKindOptions = Object.entries(PROGRAM_KIND_LABELS).map(([value, label]) => ({ value, label }));

function EditLink({ href, label = 'ویرایش' }: { href: string; label?: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <a href={href}>{label}</a>
    </Button>
  );
}

function SectionTitle({ title, note, count }: { title: string; note?: string; count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      <Badge variant="secondary">{toPersianDigits(count)} مورد</Badge>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function NewButton({ tab, label, edit = 'new' }: { tab: string; label: string; edit?: string }) {
  return (
    <Button size="sm" asChild>
      <a href={`${TAB}${tab}&edit=${edit}`}>{label}</a>
    </Button>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return <span className="grid size-10 place-items-center rounded-md bg-muted text-xs text-muted-foreground">—</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="size-10 rounded-md border border-border object-cover" />;
}

function EmptyRow({ text, span = 7 }: { text: string; span?: number }) {
  return (
    <TableRow>
      <TableCell colSpan={span} className="py-6 text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

/* ─────────────── مقالات ─────────────── */

function articleFields(row: ArticleCard | null, categories: { id: number; name: string }[]): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'title', label: 'عنوان', type: 'text', required: true, defaultValue: row?.title ?? '' },
    {
      name: 'slug',
      label: 'نشانی آدرس (slug)',
      type: 'text',
      defaultValue: row?.slug ?? '',
      hint: 'خالی بگذارید تا از عنوان ساخته شود؛ در تکراری بودن، عدد پسوند می‌گیرد.',
      placeholder: 'sample-article-slug',
    },
    {
      name: 'category_id',
      label: 'دسته',
      type: 'select',
      defaultValue: row?.category?.id ?? '',
      emptyOption: '— بدون دسته —',
      options: categories.map((item) => ({ value: String(item.id), label: item.name })),
    },
    { name: 'author', label: 'نویسنده', type: 'text', defaultValue: row?.author ?? '' },
    {
      name: 'tags',
      label: 'برچسب‌ها',
      type: 'text',
      defaultValue: row?.tags ?? '',
      hint: 'با کاما جدا کنید؛ مثلاً: محرم, معارف قرآن',
    },
    { name: 'excerpt', label: 'چکیده (اختیاری)', type: 'textarea', defaultValue: row?.excerpt ?? '', hint: 'خالی = خودکار از اولین پاراگراف متن' },
    {
      name: 'body_markdown',
      label: 'متن مقاله (markdown)',
      type: 'markdown',
      required: !row,
      defaultValue: row?.bodyMarkdown ?? '',
      hint: 'برای تصویر وسط متن: ![زیرنویس](/api/files/image/نام-فایل.jpg) — آدرس فایل را از فهرست صوت/تصویر بردارید.',
    },
    { name: 'cover', label: 'تصویر جلد', type: 'file', accept: 'image/jpeg,image/png,image/webp', hint: 'jpg/png/webp تا ۱۰ مگابایت' },
    {
      name: 'published_date',
      label: 'تاریخ انتشار (شمسی)',
      type: 'jalali',
      defaultValue: jalaliLabelToIso(row?.publishedAt ?? null) ?? '',
      hint: 'خالی = امروز، وقتی مقاله منتشر می‌شود',
    },
    { name: 'is_published', label: 'منتشر شود', type: 'checkbox', defaultValue: row?.isPublished ?? 0 },
  ];
}

/** تاریخ میلادی ذخیره‌شده را برای انتخابگر شمسی به ISO شمسی تبدیل می‌کند */
function jalaliLabelToIso(gregorian: string | null): string {
  if (!gregorian) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(gregorian.trim());
  if (!match) return '';
  const jalali = gregorianToJalali(Number(match[1]), Number(match[2]), Number(match[3]));
  return formatJalaliISO(jalali.jy, jalali.jm, jalali.jd);
}

export async function ArticlesTab({ edit }: { edit: string }) {
  const [rows, categories] = await Promise.all([adminArticles(), adminCategoryOptions('article')]);
  const current = edit === 'new' ? null : rows.find((row) => String(row.id) === edit) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title="مقالات" count={rows.length} note="فقط مقالات منتشرشده در سایت نمایش داده می‌شود." />
        <NewButton tab="articles" label="+ مقاله جدید" />
      </div>

      {edit ? (
        <ContentForm
          action={saveArticleAction}
          title={current ? `ویرایش مقاله «${current.title}»` : 'مقاله جدید'}
          cancelHref={`${TAB}articles`}
          fields={articleFields(current, categories)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>جلد</TableHead>
                <TableHead>عنوان</TableHead>
                <TableHead>دسته</TableHead>
                <TableHead>برچسب‌ها</TableHead>
                <TableHead>انتشار</TableHead>
                <TableHead>حالت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRow text="هنوز مقاله‌ای ننوشته‌اید." /> : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Thumb src={fileUrl(row.asset)} alt={row.title} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="num-latin text-xs text-muted-foreground">/articles/{row.slug}</p>
                  </TableCell>
                  <TableCell>{row.category?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs">{tagList(row.tags).join('، ') || '—'}</TableCell>
                  <TableCell className="num-latin text-xs">
                    {jalaliLabelFromIso(row.publishedAt) ?? 'بدون تاریخ'}
                  </TableCell>
                  <TableCell>
                    {row.isPublished === 1 ? (
                      <Badge className="bg-jade text-white">منتشر</Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold text-amber-800">پیش‌نویس</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}articles&edit=${row.id}`} />
                      <PublishToggle entity="article" id={row.id} checked={row.isPublished === 1} />
                      <DeleteButton entity="article" id={row.id} label="حذف" confirmText={`مقاله «${row.title}» حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────── صوت ─────────────── */

function audioFields(row: AudioRow | null): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'title', label: 'عنوان', type: 'text', required: true, defaultValue: row?.title ?? '' },
    { name: 'narrator', label: 'راوی / مداح', type: 'text', defaultValue: row?.narrator ?? '' },
    { name: 'performer', label: 'مجری / همراه', type: 'text', defaultValue: row?.performer ?? '' },
    {
      name: 'occasion',
      label: 'مناسبت',
      type: 'select',
      defaultValue: row?.occasion ?? 'other',
      options: occasionOptions,
    },
    { name: 'description', label: 'توضیح کوتاه', type: 'textarea', defaultValue: row?.description ?? '' },
    {
      name: 'file',
      label: 'فایل صوت',
      type: 'file',
      accept: 'audio/mpeg,audio/wav,audio/mp4',
      required: !row,
      hint: row ? `فایل فعلی: ${row.asset?.storedPath ?? '—'} — برای تغییر، فایل جدید انتخاب کنید.` : 'mp3/wav/m4a تا ۵۰ مگابایت',
    },
    {
      name: 'published_date',
      label: 'تاریخ انتشار (شمسی)',
      type: 'jalali',
      defaultValue: jalaliLabelToIso(row?.publishedAt ?? null) ?? '',
    },
    { name: 'is_published', label: 'منتشر شود', type: 'checkbox', defaultValue: row?.isPublished ?? 0 },
  ];
}

export async function AudioTab({ edit }: { edit: string }) {
  const rows = await adminAudios();
  const current = edit === 'new' ? null : rows.find((row) => String(row.id) === edit) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title="صوت" count={rows.length} note="پخش‌کننده پایین صفحه، فیلتر راوی و مناسبت را خودکار می‌سازد." />
        <NewButton tab="audio" label="+ صوت جدید" />
      </div>

      {edit ? (
        <ContentForm
          action={saveAudioAction}
          title={current ? `ویرایش صوت «${current.title}»` : 'صوت جدید'}
          cancelHref={`${TAB}audio`}
          fields={audioFields(current)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان</TableHead>
                <TableHead>راوی</TableHead>
                <TableHead>مناسبت</TableHead>
                <TableHead>فایل</TableHead>
                <TableHead>انتشار</TableHead>
                <TableHead>حالت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRow text="آرشیو صوت خالی است." /> : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.narrator ?? '—'}</TableCell>
                  <TableCell className="text-xs">{OCCASION_LABELS[row.occasion]}</TableCell>
                  <TableCell className="text-xs">
                    {row.asset ? (
                      <span>
                        <span className="num-latin">{formatBytes(row.asset.sizeBytes)}</span>{' '}
                        <a href={fileUrl(row.asset) ?? undefined} className="text-primary underline" target="_blank" rel="noreferrer">
                          فایل
                        </a>
                      </span>
                    ) : (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        بدون فایل
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="num-latin text-xs">{jalaliLabelFromIso(row.publishedAt) ?? '—'}</TableCell>
                  <TableCell>
                    {row.isPublished === 1 ? (
                      <Badge className="bg-jade text-white">منتشر</Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold text-amber-800">
                        منتشر نشده
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}audio&edit=${row.id}`} />
                      <PublishToggle entity="audio" id={row.id} checked={row.isPublished === 1} />
                      <DeleteButton entity="audio" id={row.id} confirmText={`صوت «${row.title}» و فایلش حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────── تصویر، آلبوم و اشخاص ─────────────── */

export async function GalleryTab({ edit, album }: { edit: string; album: string }) {
  const albumId = Number(album);
  const [albums, albumData, persons, albumOptions, photoOptions] = await Promise.all([
    adminAlbums(),
    Number.isInteger(albumId) && albumId > 0 ? getAlbumWithPhotos(albumId) : Promise.resolve(null),
    adminPersons(),
    adminAlbumOptions(),
    adminPhotoOptions(),
  ]);

  // الگوی edit در سربرگ تصویر: a<id>/anew برای آلبوم، p<id>/pnew برای شخص، <id>/new برای عکس
  const showAlbumForm = edit.startsWith('a');
  const albumCurrent =
    showAlbumForm && edit !== 'anew' ? albums.find((row) => String(row.id) === edit.slice(1)) ?? null : null;
  const showPersonForm = edit.startsWith('p');
  const personCurrent =
    showPersonForm && edit !== 'pnew' ? persons.find((row) => String(row.id) === edit.slice(1)) ?? null : null;
  const photoCurrent = albumData?.photos.find((photo) => String(photo.id) === edit) ?? null;
  const showPhotoForm = Boolean(albumData) && (edit === 'new' || Boolean(photoCurrent));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title="آلبوم‌ها" count={albums.length} note="هر آلبوم یک صفحه /gallery/شناسه دارد." />
        <NewButton tab="gallery" edit="anew" label="+ آلبوم جدید" />
      </div>

      {showAlbumForm ? (
        <ContentForm
          action={saveAlbumAction}
          title={albumCurrent ? `ویرایش آلبوم «${albumCurrent.title}»` : 'آلبوم جدید'}
          cancelHref={`${TAB}gallery`}
          fields={albumFields(albumCurrent)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>جلد</TableHead>
                <TableHead>عنوان</TableHead>
                <TableHead>عکس‌ها</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {albums.length === 0 ? <EmptyRow span={4} text="هنوز آلبومی نساخته‌اید." /> : null}
              {albums.map((row: AlbumRow) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Thumb src={fileUrl(row.cover)} alt={row.title} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.description ?? '—'}</p>
                  </TableCell>
                  <TableCell className="num-latin">{toPersianDigits(row.photoCount)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}gallery&edit=a${row.id}`} label="ویرایش آلبوم" />
                      <Button variant="outline" size="sm" asChild>
                        <a href={`${TAB}gallery&album=${row.id}`}>مدیریت عکس‌ها</a>
                      </Button>
                      <DeleteButton entity="album" id={row.id} confirmText={`آلبوم «${row.title}» به‌همراه ${row.photoCount} عکس آن حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {albumData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              عکس‌های آلبوم «{albumData.album.title}»
              <Badge variant="secondary" className="ms-2">
                {toPersianDigits(albumData.photos.length)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showPhotoForm ? (
              <ContentForm
                action={savePhotoAction}
                title={photoCurrent ? `ویرایش عکس ${photoCurrent.id}` : 'افزودن عکس'}
                cancelHref={`${TAB}gallery&album=${albumData.album.id}`}
                fields={photoFields(photoCurrent, albumData.album.id, albumOptions)}
              />
            ) : (
              <Button size="sm" asChild>
                <a href={`${TAB}gallery&album=${albumData.album.id}&edit=new`}>+ افزودن عکس</a>
              </Button>
            )}

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {albumData.photos.map((photo: PhotoRow) => (
                <div key={photo.id} className="space-y-2 rounded-lg border border-border p-2">
                  <Thumb src={fileUrl(photo.asset)} alt={photo.caption ?? ''} />
                  <p className="line-clamp-2 text-xs text-muted-foreground">{photo.caption ?? 'بدون توضیح'}</p>
                  <p className="num-latin text-xs">ترتیب: {photo.sort}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <EditLink
                      href={`${TAB}gallery&album=${albumData.album.id}&edit=${photo.id}`}
                      label="ویرایش"
                    />
                    <DeleteButton entity="photo" id={photo.id} label="حذف" confirmText="این عکس و فایلش حذف شود؟" />
                  </div>
                </div>
              ))}
              {albumData.photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">این آلبوم هنوز عکسی ندارد.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <SectionTitle title="اشخاص" count={persons.length} note="برچسب «متوفی» برای افراد از دست رفته." />
        <Button size="sm" asChild>
          <a href={`${TAB}gallery&edit=pnew`}>+ شخص جدید</a>
        </Button>
      </div>

      {showPersonForm ? (
        <ContentForm
          action={savePersonAction}
          title={personCurrent ? `ویرایش «${personCurrent.name}»` : 'شخص جدید'}
          cancelHref={`${TAB}gallery`}
          fields={personFields(personCurrent, albumOptions, photoOptions)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عکس</TableHead>
                <TableHead>نام</TableHead>
                <TableHead>آلبوم</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {persons.length === 0 ? <EmptyRow span={5} text="شخصی ثبت نشده است." /> : null}
              {persons.map((row: PersonRow) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Thumb src={fileUrl(row.mainPhoto?.asset)} alt={row.name} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.name}</p>
                    <p className="num-latin text-xs text-muted-foreground">/gallery/persons/{row.slug}</p>
                  </TableCell>
                  <TableCell className="text-xs">{row.albumTitle ?? '—'}</TableCell>
                  <TableCell>
                    {row.isDeceased === 1 ? (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        متوفی
                      </Badge>
                    ) : (
                      <Badge variant="secondary">زنده</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}gallery&edit=p${row.id}`} />
                      <DeleteButton entity="person" id={row.id} confirmText={`«${row.name}» حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function albumFields(row: AlbumRow | null): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'title', label: 'عنوان آلبوم', type: 'text', required: true, defaultValue: row?.title ?? '' },
    { name: 'description', label: 'توضیح', type: 'textarea', defaultValue: row?.description ?? '' },
    {
      name: 'cover',
      label: 'تصویر جلد آلبوم',
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      hint: 'jpg/png/webp تا ۱۰ مگابایت',
    },
  ];
}

function photoFields(row: PhotoRow | null, albumId: number, albums: { id: number; title: string }[]): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    {
      name: 'album_id',
      label: 'آلبوم',
      type: 'select',
      defaultValue: String(albumId),
      options: albums.map((album) => ({ value: String(album.id), label: album.title })),
    },
    {
      name: 'file',
      label: 'فایل تصویر',
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      required: !row,
      hint: 'jpg/png/webp تا ۱۰ مگابایت',
    },
    { name: 'caption', label: 'زیرنویس', type: 'text', defaultValue: row?.caption ?? '' },
    { name: 'sort', label: 'ترتیب نمایش', type: 'number', defaultValue: row?.sort ?? 0, hint: 'کمتر = زودتر' },
  ];
}

function personFields(
  row: PersonRow | null,
  albums: { id: number; title: string }[],
  photos: { id: number; caption: string | null; albumTitle: string | null }[],
): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'name', label: 'نام', type: 'text', required: true, defaultValue: row?.name ?? '' },
    { name: 'slug', label: 'نشانی آدرس (slug)', type: 'text', defaultValue: row?.slug ?? '', hint: 'خالی = از نام ساخته می‌شود' },
    { name: 'bio', label: 'معرفی‌نامه (markdown)', type: 'markdown', defaultValue: row?.bio ?? '' },
    { name: 'is_deceased', label: 'متوفی است', type: 'checkbox', defaultValue: row?.isDeceased ?? 0 },
    {
      name: 'album_id',
      label: 'آلبوم تصاویر',
      type: 'select',
      defaultValue: row?.albumId ?? '',
      emptyOption: '— آلبومی ندارد —',
      options: albums.map((album) => ({ value: String(album.id), label: album.title })),
      hint: 'اول آلبوم و عکس‌هایش را بسازید، بعد اینجا انتخاب کنید.',
    },
    {
      name: 'main_photo_id',
      label: 'عکس اصلی',
      type: 'select',
      defaultValue: row?.mainPhotoId ?? '',
      emptyOption: '— خودکار از آلبوم —',
      options: photos.map((photo) => ({
        value: String(photo.id),
        label: `${photo.albumTitle ?? 'بدون آلبوم'} · عکس ${photo.id}${photo.caption ? ` · ${photo.caption}` : ''}`,
      })),
    },
  ];
}

/* ─────────────── ویدئو ─────────────── */

function videoFields(row: VideoRow | null): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'title', label: 'عنوان', type: 'text', required: true, defaultValue: row?.title ?? '' },
    { name: 'occasion', label: 'مناسبت', type: 'select', defaultValue: row?.occasion ?? 'other', options: occasionOptions },
    { name: 'description', label: 'توضیح', type: 'textarea', defaultValue: row?.description ?? '' },
    {
      name: 'program_date_jalali',
      label: 'تاریخ برنامه (شمسی)',
      type: 'jalali',
      defaultValue: row?.programDateJalali ?? '',
    },
    {
      name: 'file',
      label: 'فایل ویدئو',
      type: 'file',
      accept: 'video/mp4,video/webm',
      hint: row?.asset
        ? `فایل فعلی ثبت شده است؛ برای عوض‌کردن فایل جدید بدهید (mp4/webm تا ۵۰۰ مگابایت).`
        : 'mp4/webm تا ۵۰۰ مگابایت. اگر فایل را بعداً می‌دهید، فعلاً خالی بگذارید.',
    },
    { name: 'cover', label: 'تصویر بندانگشتی', type: 'file', accept: 'image/jpeg,image/png,image/webp', hint: 'jpg/png/webp تا ۱۰ مگابایت' },
    { name: 'is_published', label: 'منتشر شود', type: 'checkbox', defaultValue: row?.isPublished ?? 0 },
  ];
}

export async function VideosTab({ edit }: { edit: string }) {
  const rows = await adminVideos();
  const current = edit === 'new' ? null : rows.find((row) => String(row.id) === edit) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle
          title="ویدئو"
          count={rows.length}
          note="فایل ویدئو داخل خود سایت سرو می‌شود؛ پخش زنده نداریم."
        />
        <NewButton tab="video" label="+ ویدئو جدید" />
      </div>

      {edit ? (
        <ContentForm
          action={saveVideoAction}
          title={current ? `ویرایش ویدئو «${current.title}»` : 'ویدئوی جدید'}
          cancelHref={`${TAB}video`}
          fields={videoFields(current)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>بندانگشتی</TableHead>
                <TableHead>عنوان</TableHead>
                <TableHead>مناسبت</TableHead>
                <TableHead>فایل</TableHead>
                <TableHead>تاریخ برنامه</TableHead>
                <TableHead>حالت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRow text="ویدئویی ثبت نشده است." /> : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Thumb src={fileUrl(row.cover)} alt={row.title} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="num-latin text-xs text-muted-foreground">/video/{row.id}</p>
                  </TableCell>
                  <TableCell className="text-xs">{OCCASION_LABELS[row.occasion]}</TableCell>
                  <TableCell className="text-xs">
                    {row.asset ? (
                      row.asset.sizeBytes > 0 ? (
                        <span className="num-latin">{formatBytes(row.asset.sizeBytes)}</span>
                      ) : (
                        <Badge variant="outline" className="border-gold text-amber-800">
                          رکورد هست، فایل نرسیده
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        بدون فایل
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="num-latin text-xs">{formatJalaliFromIso(row.programDateJalali) ?? '—'}</TableCell>
                  <TableCell>
                    {row.isPublished === 1 ? (
                      <Badge className="bg-jade text-white">منتشر</Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold text-amber-800">
                        منتشر نشده
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}video&edit=${row.id}`} />
                      <PublishToggle entity="video" id={row.id} checked={row.isPublished === 1} />
                      <DeleteButton entity="video" id={row.id} confirmText={`ویدئوی «${row.title}» حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────── برنامه‌ها ─────────────── */

export async function ProgramsTab({ edit }: { edit: string }) {
  const rows = await adminPrograms();
  const current = edit === 'new' ? null : rows.find((row) => String(row.id) === edit) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle
          title="برنامه‌ها"
          count={rows.length}
          note="تفکیک «پیش‌رو» و «برگزارشده» بر پایه امروز شمسی خودکار انجام می‌شود."
        />
        <NewButton tab="programs" label="+ برنامه جدید" />
      </div>

      {edit ? (
        <ContentForm
          action={saveProgramAction}
          title={current ? `ویرایش «${current.title}»` : 'برنامه جدید'}
          cancelHref={`${TAB}programs`}
          fields={programFields(current)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead>ساعت</TableHead>
                <TableHead>مکان</TableHead>
                <TableHead>نوع</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRow text="برنامه‌ای ثبت نشده است." /> : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell className="num-latin text-xs">{formatJalaliFromIso(row.dateJalali)}</TableCell>
                  <TableCell className="num-latin text-xs">{row.startTime ?? '—'}</TableCell>
                  <TableCell className="text-xs">{row.place ?? '—'}</TableCell>
                  <TableCell className="text-xs">{PROGRAM_KIND_LABELS[row.kind]}</TableCell>
                  <TableCell>
                    {row.isCancelled === 1 ? (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        لغو شده
                      </Badge>
                    ) : (
                      <Badge variant="secondary">برگزار می‌شود</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}programs&edit=${row.id}`} />
                      <DeleteButton entity="program" id={row.id} confirmText={`برنامه «${row.title}» حذف شود؟`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function programFields(row: { id: number; title: string; dateJalali: string; startTime: string | null; place: string | null; kind: string; isCancelled: number; description: string | null } | null): FieldSpec[] {
  return [
    { name: 'id', label: 'شناسه', type: 'number', defaultValue: row?.id ?? '' },
    { name: 'title', label: 'عنوان برنامه', type: 'text', required: true, defaultValue: row?.title ?? '' },
    { name: 'date_jalali', label: 'تاریخ (شمسی)', type: 'jalali', required: true, defaultValue: row?.dateJalali ?? '' },
    { name: 'start_time', label: 'ساعت شروع', type: 'time', defaultValue: row?.startTime ?? '' },
    { name: 'place', label: 'مکان', type: 'text', defaultValue: row?.place ?? '', placeholder: 'حسیه / تالار اجتماعات' },
    { name: 'kind', label: 'نوع برنامه', type: 'select', defaultValue: row?.kind ?? 'ceremony', options: programKindOptions },
    { name: 'description', label: 'توضیح', type: 'textarea', defaultValue: row?.description ?? '' },
    { name: 'is_cancelled', label: 'لغو شده است', type: 'checkbox', defaultValue: row?.isCancelled ?? 0 },
  ];
}

/* ─────────────── دسته‌ها ─────────────── */

const CATEGORY_KIND_LABELS: Record<string, string> = {
  article: 'مقاله',
  audio: 'صوت',
  video: 'ویدئو',
  program: 'برنامه',
};

export async function CategoriesTab({ edit }: { edit: string }) {
  const rows = await adminCategoryOptions();
  const current = edit === 'new' ? null : rows.find((row) => String(row.id) === edit) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title="دسته‌ها" count={rows.length} note="دسته‌ی مقاله در فیلتر فهرست مقالات استفاده می‌شود." />
        <NewButton tab="categories" label="+ دسته جدید" />
      </div>

      {edit ? (
        <ContentForm
          action={saveCategoryAction}
          title={current ? `ویرایش دسته «${current.name}»` : 'دسته جدید'}
          cancelHref={`${TAB}categories`}
          fields={[
            { name: 'id', label: 'شناسه', type: 'number', defaultValue: current?.id ?? '' },
            { name: 'name', label: 'نام دسته', type: 'text', required: true, defaultValue: current?.name ?? '' },
            {
              name: 'kind',
              label: 'کاربری',
              type: 'select',
              defaultValue: current?.kind ?? 'article',
              options: Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام</TableHead>
                <TableHead>slug</TableHead>
                <TableHead>کاربری</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRow span={4} text="دسته‌ای نساخته‌اید." /> : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="num-latin text-xs">{row.slug}</TableCell>
                  <TableCell className="text-xs">{CATEGORY_KIND_LABELS[row.kind]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditLink href={`${TAB}categories&edit=${row.id}`} />
                      <DeleteButton entity="category" id={row.id} confirmText={`دسته «${row.name}» حذف شود؟ مقالات آن بدون دسته می‌مانند.`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

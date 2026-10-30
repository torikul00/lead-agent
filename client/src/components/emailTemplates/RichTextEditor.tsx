import { useRef, useState, type ChangeEvent } from 'react'
import { EditorContent, Extension, useEditor, type Editor } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, LoaderCircle, Underline, type LucideIcon } from 'lucide-react'
import { TEMPLATE_PLACEHOLDERS } from '@/constants/emails.ts'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'

type ToolbarButtonProps = {
    label: string
    icon: LucideIcon
    active: boolean
    onClick: () => void
}

function ToolbarButton({ label, icon: Icon, active, onClick }: ToolbarButtonProps) {
    return (
        <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active} className={`cursor-pointer rounded-lg p-1.5 transition ${active ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
            <Icon className="size-4" />
        </button>
    )
}

// Colors {{placeholders}} while editing; it's display only, so the saved HTML and the sent email stay plain
const PlaceholderHighlight = Extension.create({
    name: 'placeholderHighlight',
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations: (state) => {
                        const decorations: Decoration[] = []
                        state.doc.descendants((node, pos) => {
                            if (!node.text) return
                            for (const match of node.text.matchAll(/\{\{\s*\w+\s*\}\}/g)) {
                                const from = pos + match.index
                                decorations.push(Decoration.inline(from, from + match[0].length, { class: 'template-placeholder', spellcheck: 'false' }))
                            }
                        })
                        return DecorationSet.create(state.doc, decorations)
                    },
                },
            }),
        ]
    },
})

// Ask for the link address; an empty address removes the link
const editLink = (editor: Editor) => {
    const url = window.prompt('Link address', editor.getAttributes('link').href ?? 'https://')
    if (url === null) return

    const chain = editor.chain().focus().extendMarkRange('link')
    if (url.trim()) chain.setLink({ href: url.trim() }).run()
    else chain.unsetLink().run()
}

type RichTextEditorProps = {
    value: string
    onChange: (html: string) => void
    // A smaller editor without template placeholders, for replies
    simple?: boolean
}

export default function RichTextEditor({ value, onChange, simple = false }: RichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const starterKit = StarterKit.configure({ heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false } })
    const image = Image.configure({ inline: false, allowBase64: false })
    const editor = useEditor({
        extensions: simple ? [starterKit, image] : [starterKit, image, PlaceholderHighlight],
        content: value,
        // Re-render on every change so the toolbar shows the formatting under the cursor
        shouldRerenderOnTransaction: true,
        // An empty editor still holds "<p></p>", so report it as empty
        onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
        editorProps: { attributes: { 'aria-label': simple ? 'Reply' : 'Email body', class: `rich-text ${simple ? 'max-h-60 min-h-24 overflow-y-auto' : 'min-h-60'} px-4 py-3 text-sm text-slate-900 outline-none` } },
    })

    if (!editor) return null

    const uploadImage = async (file: File) => {
        setUploadError('')
        setUploading(true)
        const formData = new FormData()
        formData.append('image', file)

        try {
            const { data } = await api.post<{ url: string }>('/emails/templates/images', formData)
            editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
        } catch (err) {
            setUploadError(getErrorMessage(err))
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) void uploadImage(file)
    }

    const tools = [
        { name: 'bold', label: 'Bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
        { name: 'italic', label: 'Italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
        { name: 'underline', label: 'Underline', icon: Underline, run: () => editor.chain().focus().toggleUnderline().run() },
        { name: 'bulletList', label: 'Bulleted list', icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
        { name: 'orderedList', label: 'Numbered list', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run() },
        { name: 'link', label: 'Link', icon: Link2, run: () => editLink(editor) },
    ]

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
                {tools.map((tool) => (
                    <ToolbarButton key={tool.name} label={tool.label} icon={tool.icon} active={editor.isActive(tool.name)} onClick={tool.run} />
                ))}

                <span className="mx-1 h-5 w-px bg-slate-200" />

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload image" aria-label="Upload image" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60">
                    {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    {uploading ? 'Uploading...' : 'Image'}
                </button>

                {!simple && (
                    <>
                        <span className="mx-1 h-5 w-px bg-slate-200" />

                        {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                            <button key={placeholder} type="button" onClick={() => editor.chain().focus().insertContent(`{{${placeholder}}}`).run()} title="Insert placeholder" className="cursor-pointer rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 transition hover:bg-primary/10 hover:text-primary">
                                {`{{${placeholder}}}`}
                            </button>
                        ))}
                    </>
                )}
            </div>

            <EditorContent editor={editor} />
            {uploadError && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{uploadError}</p>}
        </div>
    )
}

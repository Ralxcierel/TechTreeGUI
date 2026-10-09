// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { addNode, createEmptyDocument, updateNodeData } from '../../model'
import { Inspector } from './Inspector'
import { NodeTypeInspector } from './NodeTypeInspector'

const store = useEditorStore
const s = () => store.getState()
const era = () => s().doc.nodeTypes.find((t) => t.id === 'era')!
const fieldBox = (name: string) => screen.getByRole('group', { name })

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  doc = addNode(doc, 'era', { x: 0, y: 0 }, 'a')
  doc = updateNodeData(doc, 'a', 'title', 'Bronze Age')
  s().loadDocument(doc)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('NodeTypeInspector: the type', () => {
  it('edits name and look', () => {
    render(<NodeTypeInspector typeId="era" />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Age' } })
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'pill' } })
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '200' } })
    const fill = screen.getByLabelText('Fill')
    fireEvent.focus(fill)
    fireEvent.change(fill, { target: { value: '#123456' } })
    expect(era()).toMatchObject({
      name: 'Age',
      style: { shape: 'pill', width: 200, fill: '#123456' },
    })
  })

  it('blocks deleting a type in use (D8) and deletes an unused one after asking (D12)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { unmount } = render(<NodeTypeInspector typeId="era" />)
    const del = screen.getByRole('button', { name: 'Delete node type' }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(screen.getByText('1 node uses this type. Change or delete it first.')).toBeTruthy()
    unmount()

    s().editNodeType('note')
    render(<Inspector />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete node type' }))
    expect(confirm).toHaveBeenCalledWith('Delete the node type "Note"?')
    expect(s().doc.nodeTypes.map((t) => t.id)).toEqual(['technology', 'era'])
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
  })
})

describe('NodeTypeInspector: fields', () => {
  it('adds a field and edits its label, kind, choices and default', () => {
    render(<NodeTypeInspector typeId="era" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }))
    const box = within(fieldBox('New field'))
    fireEvent.change(box.getByLabelText('Label'), { target: { value: 'Age' } })
    const age = within(fieldBox('Age'))
    fireEvent.change(age.getByLabelText('Kind'), { target: { value: 'enum' } })
    expect(era().fields[1]).toMatchObject({ label: 'Age', kind: 'enum', options: ['Option 1'] })

    const choices = age.getByLabelText('Choices')
    fireEvent.change(choices, { target: { value: 'Stone\nIron\n' } })
    fireEvent.blur(choices)
    expect(era().fields[1]!.options).toEqual(['Stone', 'Iron'])
    fireEvent.change(age.getByLabelText('Default for new nodes'), { target: { value: 'Iron' } })
    expect(era().fields[1]!.default).toBe('Iron')
  })

  it('renames a key on Enter, moving node values; a refused key shows why and reverts', () => {
    s().setNodeField('a', 'old', 1)
    render(<NodeTypeInspector typeId="era" />)
    const key = within(fieldBox('Name')).getByLabelText(/^Key/) as HTMLInputElement

    fireEvent.change(key, { target: { value: 'old' } })
    fireEvent.keyDown(key, { key: 'Enter' })
    expect(screen.getByRole('alert').textContent).toMatch(/already has data under "old"/)
    expect(key.value).toBe('title')

    fireEvent.change(key, { target: { value: ' name ' } })
    // Typing alone doesn't rename anything yet.
    expect(era().fields[0]!.key).toBe('title')
    fireEvent.keyDown(key, { key: 'Enter' })
    expect(era().fields[0]!.key).toBe('name')
    expect(s().doc.nodes[0]!.data).toMatchObject({ name: 'Bronze Age' })
  })

  it('Escape puts the saved key back; leaving the box commits', () => {
    render(<NodeTypeInspector typeId="era" />)
    const key = within(fieldBox('Name')).getByLabelText(/^Key/) as HTMLInputElement
    fireEvent.change(key, { target: { value: 'zzz' } })
    fireEvent.keyDown(key, { key: 'Escape' })
    expect(key.value).toBe('title')
    fireEvent.blur(key)
    expect(era().fields[0]!.key).toBe('title')

    fireEvent.change(key, { target: { value: 'label' } })
    fireEvent.blur(key)
    expect(era().fields[0]!.key).toBe('label')
  })

  it('changes where a field shows', () => {
    render(<NodeTypeInspector typeId="era" />)
    const where = within(screen.getByRole('group', { name: 'Where field title shows' }))
    fireEvent.click(where.getByLabelText('Tooltip'))
    fireEvent.click(where.getByLabelText('Card'))
    expect(era().fields[0]!.show).toEqual(['tooltip'])
  })

  it('moves fields and removes one after asking, keeping node values', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    s().addField('era')
    render(<NodeTypeInspector typeId="era" />)
    expect(
      (screen.getByRole('button', { name: 'Move field title up' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Move field field up' }))
    expect(era().fields.map((f) => f.key)).toEqual(['field', 'title'])

    fireEvent.click(screen.getByRole('button', { name: 'Remove field title' }))
    expect(confirm).toHaveBeenCalled()
    expect(era().fields).toHaveLength(2)
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove field title' }))
    expect(era().fields.map((f) => f.key)).toEqual(['field'])
    expect(s().doc.nodes[0]!.data.title).toBe('Bronze Age')
  })
})

describe('NodeTypeInspector: review fixes', () => {
  it('keeps focus in the key box after a rename with Enter', () => {
    render(<NodeTypeInspector typeId="era" />)
    const key = within(fieldBox('Name')).getByLabelText(/^Key/) as HTMLInputElement
    key.focus()
    fireEvent.change(key, { target: { value: 'name' } })
    fireEvent.keyDown(key, { key: 'Enter' })
    expect(era().fields[0]!.key).toBe('name')
    // Same element, still focused, showing the new key.
    expect(document.activeElement).toBe(key)
    expect(key.value).toBe('name')
  })

  it("a click on the field's own button still works right after a rename on blur", () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    s().addField('era')
    render(<NodeTypeInspector typeId="era" />)
    const key = within(fieldBox('New field')).getByLabelText(/^Key/) as HTMLInputElement
    const remove = screen.getByRole('button', { name: 'Remove field field' })
    fireEvent.change(key, { target: { value: 'extra' } })
    fireEvent.blur(key)
    // The button is the same element, now named for the new key.
    expect(remove.isConnected).toBe(true)
    expect(remove.getAttribute('aria-label')).toBe('Remove field extra')
    fireEvent.click(remove)
    expect(era().fields.map((f) => f.key)).toEqual(['title'])
  })

  it('an untouched key with spaces from a file is not renamed by focus and blur', () => {
    s().renameFieldKey('era', 'title', ' t ')
    render(<NodeTypeInspector typeId="era" />)
    const key = within(fieldBox('Name')).getByLabelText(/^Key/)
    fireEvent.focus(key)
    fireEvent.blur(key)
    expect(era().fields[0]!.key).toBe(' t ')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"No default" removes a default that its input cannot clear (e.g. text)', () => {
    render(<NodeTypeInspector typeId="era" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove the default of field title' }))
    expect(era().fields[0]).not.toHaveProperty('default')
    expect(screen.queryByRole('button', { name: /Remove the default/ })).toBeNull()
  })

  it('an emptied Choices box is refused on leaving it, and shows the saved choices again', () => {
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum', options: ['Stone', 'Iron'] })
    render(<NodeTypeInspector typeId="era" />)
    const box = within(fieldBox('New field'))
    const choices = box.getByLabelText('Choices') as HTMLTextAreaElement
    fireEvent.change(choices, { target: { value: '' } })
    fireEvent.blur(choices)
    expect(box.getByRole('alert').textContent).toMatch(/at least one choice/)
    expect(choices.value).toBe('Stone\nIron')
    expect(era().fields[1]!.options).toEqual(['Stone', 'Iron'])
  })

  it('choices save on leaving the box, so editing the default choice keeps the default', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum', options: ['Low', 'High'] })
    s().setFieldDefault('era', key, 'High')
    render(<NodeTypeInspector typeId="era" />)
    const choices = within(fieldBox('New field')).getByLabelText('Choices') as HTMLTextAreaElement

    // Typing alone saves nothing (the default "High" survives "Highe").
    fireEvent.change(choices, { target: { value: 'Low\nHighe' } })
    expect(era().fields[1]).toMatchObject({ options: ['Low', 'High'], default: 'High' })

    // Leaving with the default gone asks first; Cancel keeps everything.
    confirm.mockReturnValue(false)
    fireEvent.change(choices, { target: { value: 'Low\nHighest' } })
    fireEvent.blur(choices)
    expect(confirm).toHaveBeenCalledWith(
      '"High" is the default but no longer a choice. Save the choices and remove the default?',
    )
    expect(era().fields[1]).toMatchObject({ options: ['Low', 'High'], default: 'High' })
    expect(choices.value).toBe('Low\nHigh')

    // OK saves them and drops the default.
    confirm.mockReturnValue(true)
    fireEvent.change(choices, { target: { value: 'Low\nHighest' } })
    fireEvent.blur(choices)
    expect(era().fields[1]!.options).toEqual(['Low', 'Highest'])
    expect(era().fields[1]).not.toHaveProperty('default')

    // Keeping the default among the choices doesn't ask.
    confirm.mockClear()
    s().setFieldDefault('era', key, 'Low')
    fireEvent.change(choices, { target: { value: 'Low\nMid\nHighest' } })
    fireEvent.blur(choices)
    expect(confirm).not.toHaveBeenCalled()
    expect(era().fields[1]).toMatchObject({ options: ['Low', 'Mid', 'Highest'], default: 'Low' })
  })

  it('a removed renamed field leaves no alias behind for a later field with its key', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    s().addField('era')
    render(<NodeTypeInspector typeId="era" />)
    const keyInput = within(fieldBox('New field')).getByLabelText(/^Key/)
    fireEvent.change(keyInput, { target: { value: 'field-2' } })
    fireEvent.blur(keyInput)
    fireEvent.click(screen.getByRole('button', { name: 'Remove field field-2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add field' })) // "field"
    const first = screen.getByRole('button', { name: 'Remove field field' })
    fireEvent.click(screen.getByRole('button', { name: 'Add field' })) // "field-2"
    // The first new field's editor wasn't taken over by the second one.
    expect(first.isConnected).toBe(true)
    expect(first.getAttribute('aria-label')).toBe('Remove field field')
  })
})

describe('NodeTypeInspector: review round 2 fixes', () => {
  it('typing a default keeps focus in the box, letter after letter', () => {
    const key = s().addField('era')
    render(<NodeTypeInspector typeId="era" />)
    const box = within(fieldBox('New field')).getByLabelText('Default for new nodes')
    box.focus()
    fireEvent.change(box, { target: { value: 'B' } })
    expect(document.activeElement).toBe(box)
    fireEvent.change(box, { target: { value: 'Bronze' } })
    expect(era().fields.find((f) => f.key === key)!.default).toBe('Bronze')
  })

  it('a rename keeps the Choices and Default inputs', () => {
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum' })
    render(<NodeTypeInspector typeId="era" />)
    const box = within(fieldBox('New field'))
    const choices = box.getByLabelText('Choices')
    const def = box.getByLabelText('Default for new nodes')
    const keyInput = box.getByLabelText(/^Key/)
    fireEvent.change(keyInput, { target: { value: 'age' } })
    fireEvent.blur(keyInput)
    expect(era().fields[1]!.key).toBe('age')
    expect(choices.isConnected).toBe(true)
    expect(def.isConnected).toBe(true)
  })

  it('asks before a kind change that loses choices or the default', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum', options: ['A'] })
    s().setFieldDefault('era', key, 'A')
    render(<NodeTypeInspector typeId="era" />)
    const kind = within(fieldBox('New field')).getByLabelText('Kind')
    fireEvent.change(kind, { target: { value: 'text' } })
    expect(confirm).toHaveBeenCalledWith('Change "New field" to Text? This removes its choices.')
    expect(era().fields[1]!.kind).toBe('enum')
    fireEvent.change(kind, { target: { value: 'number' } })
    expect(confirm).toHaveBeenLastCalledWith(
      'Change "New field" to Number? This removes its choices and its default.',
    )
    confirm.mockReturnValue(true)
    fireEvent.change(kind, { target: { value: 'number' } })
    expect(era().fields[1]).toMatchObject({ kind: 'number' })

    // Nothing to lose: no question.
    confirm.mockClear()
    fireEvent.change(kind, { target: { value: 'list' } })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('leaving the Choices box with only spacing changes tidies it without saving or asking', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum', options: ['Low', 'High'] })
    const before = s().doc
    render(<NodeTypeInspector typeId="era" />)
    const choices = within(fieldBox('New field')).getByLabelText('Choices') as HTMLTextAreaElement
    fireEvent.change(choices, { target: { value: ' Low \n\nLow\nHigh' } })
    fireEvent.blur(choices)
    expect(choices.value).toBe('Low\nHigh')
    expect(s().doc).toBe(before)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('a refused (empty) list of choices shows why; the next good save clears it', () => {
    const key = s().addField('era')
    s().updateField('era', key, { kind: 'enum' })
    render(<NodeTypeInspector typeId="era" />)
    const box = within(fieldBox('New field'))
    const choices = box.getByLabelText('Choices')
    fireEvent.change(choices, { target: { value: '' } })
    fireEvent.blur(choices)
    expect(box.getByRole('alert')).toBeTruthy()
    fireEvent.change(choices, { target: { value: 'A' } })
    fireEvent.blur(choices)
    expect(box.queryByRole('alert')).toBeNull()
    expect(era().fields[1]!.options).toEqual(['A'])
  })
})

describe('NodeTypeInspector: icon', () => {
  it('sets the type icon, and an empty box removes it', () => {
    render(<NodeTypeInspector typeId="era" />)
    fireEvent.change(screen.getByLabelText('Icon'), { target: { value: '⚙' } })
    expect(era().style.icon).toBe('⚙')
    fireEvent.change(screen.getByLabelText('Icon'), { target: { value: '' } })
    expect(era().style.icon).toBeNull()
  })
})

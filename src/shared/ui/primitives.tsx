import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
export function Button({type = 'button', className = '', ...props}: ComponentProps<'button'>) {
 return <button type={type} className={`ui-button ${className}`} {...props} />;
}
export function IconButton(props: ComponentProps<'button'> & {'aria-label':string}) {return <Button {...props} data-icon-button />;}
export function TextField({className = '', ...props}: ComponentProps<'input'>) {return <input className={`ui-input ${className}`} {...props} />;}
export function TextArea({className = '', ...props}: ComponentProps<'textarea'>) {return <textarea className={`ui-input ${className}`} {...props} />;}
export function SelectField({className = '', ...props}: ComponentProps<'select'>) {return <select className={`field ${className}`} {...props} />;}
export function Surface({as:Tag = 'div',variant = 'panel',className = '',...props}: HTMLAttributes<HTMLElement> & {as?:'div'|'section'|'article'; variant?:'panel'|'interactive'}) {
 return <Tag {...props} className={`ui-surface ${className}`} data-surface={variant} />;
}
export function ListItem(props: ComponentProps<'button'>) {return <Button {...props} data-surface="interactive" />;}
export function StatusText(props: HTMLAttributes<HTMLSpanElement>) {return <span {...props} className={`ui-status ${props.className || ''}`} />;}
export function FieldGroup({id,label,hint,error,children}: {id:string;label:string;hint?:string;error?:string;children:ReactNode}) {
 return <div className="config-field"><label htmlFor={id}>{label}</label>{children}{hint && <p id={`${id}-hint`} className="field-help">{hint}</p>}{error && <p id={`${id}-error`} role="alert">{error}</p>}</div>;
}
export function Disclosure({ label, children, ...props }: ComponentProps<'details'> & { label: string }) {
 return <details {...props} className={`ui-disclosure ${props.className || ''}`}><summary>{label}</summary>{children}</details>;
}

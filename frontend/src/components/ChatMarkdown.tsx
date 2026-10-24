import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatMarkdown({children}:{children:string}) {
 return <div className="chat-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,img:({alt})=><span>{alt}</span>}}>{children}</Markdown></div>;
}

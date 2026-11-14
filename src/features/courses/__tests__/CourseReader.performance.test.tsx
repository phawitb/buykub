import { render,screen,fireEvent } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { CourseReader } from '../CourseReader';
const lessons=[{id:'one',title:'First',content_html:'<p>Lesson text</p>',youtube_url:'https://www.youtube.com/embed/aqz-KE-bpKQ',documents:[]},{id:'two',title:'Second',content_html:'<p>Next text</p>',youtube_url:'https://www.youtube.com/embed/aqz-KE-bpKQ',documents:[]}];
it('shows lesson text without loading YouTube until requested and resets on lesson change',()=>{
 vi.stubGlobal('scrollTo',vi.fn());
 const {container}=render(<CourseReader productId="course" name="Course" lessons={lessons} expiresAt={null} owner={false}/>);
 expect(screen.getByText('Lesson text')).toBeInTheDocument();
 expect(container.querySelector('iframe')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'เปิดวิดีโอบทเรียน First'}));
 expect(screen.getByTitle('วิดีโอ First')).toHaveAttribute('src',lessons[0].youtube_url);
 fireEvent.click(screen.getByRole('button',{name:'บทถัดไป'}));
 expect(screen.getByText('Next text')).toBeInTheDocument();
 expect(container.querySelector('iframe')).toBeNull();
 vi.unstubAllGlobals();
});

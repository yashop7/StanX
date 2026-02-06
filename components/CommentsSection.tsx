import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  user: {
    name: string;
    username: string;
    avatar?: string;
    initials: string;
  };
  text: string;
  timeAgo: string;
  likes: number;
  replies?: Comment[];
}

const demoComments: Comment[] = [
  {
    id: '1',
    user: {
      name: 'Alex Thompson',
      username: 'alexthompson',
      initials: 'AT',
    },
    text: 'Looking at historical data, the Fed has been consistently dovish lately. I think a 25 bps decrease is most likely.',
    timeAgo: '2 hours ago',
    likes: 12,
    replies: [
      {
        id: '1-1',
        user: {
          name: 'Sarah Chen',
          username: 'sarachen',
          initials: 'SC',
        },
        text: 'Agreed, but recent inflation data might change their stance.',
        timeAgo: '1 hour ago',
        likes: 5,
      },
    ],
  },
  {
    id: '2',
    user: {
      name: 'Mike Johnson',
      username: 'mikej',
      initials: 'MJ',
    },
    text: 'The market sentiment has shifted significantly in the past week. Worth watching closely.',
    timeAgo: '5 hours ago',
    likes: 8,
  },
  {
    id: '3',
    user: {
      name: 'Emily Rodriguez',
      username: 'emilyR',
      initials: 'ER',
    },
    text: 'I\'ve been tracking Fed statements and the signals are pretty clear. Banking on YES here.',
    timeAgo: '1 day ago',
    likes: 15,
  },
];

export const CommentsSection = () => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(demoComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handlePostComment = () => {
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    const newComment: Comment = {
      id: Date.now().toString(),
      user: {
        name: 'You',
        username: 'you',
        initials: 'YO',
      },
      text: comment,
      timeAgo: 'Just now',
      likes: 0,
    };

    setComments([newComment, ...comments]);
    setComment('');
    toast.success('Comment posted!');
  };

  const handlePostReply = (parentId: string) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    const newReply: Comment = {
      id: `${parentId}-${Date.now()}`,
      user: {
        name: 'You',
        username: 'you',
        initials: 'YO',
      },
      text: replyText,
      timeAgo: 'Just now',
      likes: 0,
    };

    setComments(comments.map(c => {
      if (c.id === parentId) {
        return {
          ...c,
          replies: [...(c.replies || []), newReply],
        };
      }
      return c;
    }));

    setReplyText('');
    setReplyingTo(null);
    toast.success('Reply posted!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Discussion</CardTitle>
        <CardDescription>
          Share your predictions and insights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Input */}
        <div className="space-y-3">
          <Textarea
            placeholder="What's your take on this market?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {500 - comment.length} characters remaining
            </span>
            <Button size="sm" onClick={handlePostComment}>
              Post Comment
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-3">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={comment.user.avatar} />
                  <AvatarFallback>{comment.user.initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {comment.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{comment.user.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {comment.timeAgo}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{comment.text}</p>

                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      <span className="text-xs">{comment.likes}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-xs">Reply</span>
                    </Button>
                  </div>

                  {/* Reply Input */}
                  {replyingTo === comment.id && (
                    <div className="space-y-2 pt-2">
                      <Textarea
                        placeholder={`Reply to ${comment.user.name}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[80px] resize-none"
                        maxLength={500}
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handlePostReply(comment.id)}>
                          Post Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-8 space-y-3 pt-3 border-l-2 border-border pl-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={reply.user.avatar} />
                            <AvatarFallback>{reply.user.initials}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {reply.user.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{reply.user.username}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                • {reply.timeAgo}
                              </span>
                            </div>

                            <p className="text-sm leading-relaxed">{reply.text}</p>

                            <div className="flex items-center gap-4">
                              <Button variant="ghost" size="sm" className="h-7 gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                <span className="text-xs">{reply.likes}</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <Button variant="outline" className="w-full">
          Load More Comments
        </Button>
      </CardContent>
    </Card>
  );
};

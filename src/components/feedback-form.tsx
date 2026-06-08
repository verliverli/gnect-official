'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Lightbulb, Send, MessageCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from 'sonner'

export function FeedbackForm() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'feedback' | 'feature_request'>('feedback')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please enter your feedback')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: content.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Thanks for your feedback!')
        setContent('')
        setType('feedback')
        setOpen(false)
      } else {
        toast.error(data.error || 'Failed to submit')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left active:scale-[0.98]">
          <Lightbulb className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-primary">Send Feedback</p>
            <p className="text-[10px] text-muted-foreground">Share ideas or report issues</p>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader>
          <SheetTitle className="text-left">Send Feedback</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('feedback')}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                type === 'feedback' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Feedback</span>
            </button>
            <button
              onClick={() => setType('feature_request')}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                type === 'feature_request' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Feature Request</span>
            </button>
          </div>

          {/* Text area */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-muted-foreground">Your message</span>
              <span className="text-xs text-muted-foreground">{content.length}/1000</span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => { if (e.target.value.length <= 1000) setContent(e.target.value) }}
              placeholder={type === 'feedback' ? 'Tell us what you think...' : 'Describe the feature you want...'}
              className="rounded-xl text-sm resize-none"
              rows={5}
              maxLength={1000}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full rounded-xl h-11 font-bold"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

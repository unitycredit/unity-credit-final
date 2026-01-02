'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { creditCardSchema, type CreditCardInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

interface CreditCardFormProps {
  onSubmit: (card: CreditCardInput) => Promise<void>
}

export default function CreditCardForm({ onSubmit }: CreditCardFormProps) {
  const { toast } = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreditCardInput>({
    resolver: zodResolver(creditCardSchema),
  })

  const onFormSubmit = async (data: CreditCardInput) => {
    try {
      await onSubmit(data)
      reset()
      toast({
        title: 'געטאָן',
        description: 'דער קאַרטל איז צוגעגעבן געוואָרן.',
      })
    } catch (error: any) {
      toast({
        title: 'טעות',
        description: error.message || 'עס איז נישט געלונגען צו צולייגן דעם קאַרטל.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="rtl-text border-0 shadow-xl overflow-hidden">
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last4" className="rtl-text">
                לעצטע 4 נומערן *
              </Label>
              <Input
                id="last4"
                type="text"
                maxLength={4}
                placeholder="1234"
                dir="rtl"
                {...register('last4')}
                className={errors.last4 ? 'border-destructive' : ''}
              />
              {errors.last4 && (
                <p className="text-sm text-destructive rtl-text">
                  {errors.last4.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="rtl-text">
                קארטל נאמען *
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="וויזה, מאסטערקארד"
                dir="rtl"
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive rtl-text">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit" className="rtl-text">
                לימיט *
              </Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                dir="rtl"
                {...register('limit', { valueAsNumber: true })}
                className={errors.limit ? 'border-destructive' : ''}
              />
              {errors.limit && (
                <p className="text-sm text-destructive rtl-text">
                  {errors.limit.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance" className="rtl-text">
                באלאנס *
              </Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                dir="rtl"
                {...register('balance', { valueAsNumber: true })}
                className={errors.balance ? 'border-destructive' : ''}
              />
              {errors.balance && (
                <p className="text-sm text-destructive rtl-text">
                  {errors.balance.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apr" className="rtl-text">
                APR% (אפּשאַנעל)
              </Label>
              <Input
                id="apr"
                type="number"
                step="0.1"
                min="0"
                max="60"
                placeholder="22"
                dir="rtl"
                {...register('apr', { valueAsNumber: true })}
                className={errors.apr ? 'border-destructive' : ''}
              />
              {errors.apr && (
                <p className="text-sm text-destructive rtl-text">
                  {errors.apr.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground rtl-text">
                אויב איר ווייסט נישט דעם APR, לאזט ליידיג.
              </p>
            </div>
          </div>
          <Button
            type="submit"
            variant="default"
            className="w-full bg-[#D4AF37] hover:bg-[#c6a233] text-[#001f3f] font-black justify-center"
            disabled={isSubmitting}
          >
            <span dir="ltr">Add Card</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

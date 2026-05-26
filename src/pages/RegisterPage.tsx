import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Field } from '../components/Field';
import { UsersApi } from '../api/endpoints';
import type { CreateUserDto } from '../api/generated/types';
import { Link, useNavigate } from 'react-router-dom';
import { getResponseMessage } from '../api/apiResponse';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  userName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(3),
});

type Form = z.infer<typeof schema>;

export default function RegisterPage(){
  const nav = useNavigate();
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<Form>();
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (form: Form) => {
    setMsg(null);
    const dto: CreateUserDto = { firstName: form.firstName, lastName: form.lastName, userName: form.userName, email: form.email, password: form.password } as any;
    try {
      await UsersApi.create(dto);
      setMsg('Usuário criado! Faça login.');
      setTimeout(() => nav('/login'), 600);
    } catch (e) {
      toast.error(getResponseMessage(e, "Falha ao criar usuário."));
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="card w-full max-w-md p-6">
        <div className="text-2xl font-black tracking-tight">Criar usuário</div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Username">
            <input className="input" {...register('userName')} placeholder="Username" />
          </Field>
          <Field label="Nome">
            <input className="input" {...register('firstName')} placeholder="Nome" />
          </Field>
          <Field label="Sobrenome">
            <input className="input" {...register('lastName')} placeholder="Sobrenome" />
          </Field>
          <Field label="Email">
            <input
              className="input"
              placeholder="voce@email.com"
              {...register('email', {
                required: 'Email é obrigatório',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' },
              })}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </Field>
          <Field label="Senha">
            <input className="input" type="password" {...register('password')} placeholder="••••••••" />
          </Field>

          {msg ? <div className="text-sm text-emerald-700">{msg}</div> : null}

          <button className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar'}
          </button>

          <div className="text-sm text-slate-600 dark:text-slate-400">
            Já tem conta? <Link className="underline" to="/login">Entrar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

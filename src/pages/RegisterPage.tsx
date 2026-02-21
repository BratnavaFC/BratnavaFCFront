import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '../components/Field';
import { UsersApi } from '../api/endpoints';
import type { CreateUserDto } from '../api/generated/types';
import { Link, useNavigate } from 'react-router-dom';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(3),
});

type Form = z.infer<typeof schema>;

export default function RegisterPage(){
  const nav = useNavigate();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>();
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (form: Form) => {
    setMsg(null);
    const dto: CreateUserDto = { name: form.name, email: form.email, password: form.password } as any;
    await UsersApi.create(dto);
    setMsg('Usuário criado! Faça login.');
    setTimeout(() => nav('/login'), 600);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card w-full max-w-md p-6">
        <div className="text-2xl font-black tracking-tight">Criar usuário</div>
        <div className="muted mt-1">Cadastro via /api/Users</div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Nome">
            <input className="input" {...register('name')} placeholder="Seu nome" />
          </Field>
          <Field label="Email">
            <input className="input" {...register('email')} placeholder="voce@email.com" />
          </Field>
          <Field label="Senha">
            <input className="input" type="password" {...register('password')} placeholder="••••••••" />
          </Field>

          {msg ? <div className="text-sm text-emerald-700">{msg}</div> : null}

          <button className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar'}
          </button>

          <div className="text-sm text-slate-600">
            Já tem conta? <Link className="underline" to="/login">Entrar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

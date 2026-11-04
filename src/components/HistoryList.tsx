import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MedicalHistoryForm from "./MedicalHistoryForm";
import { dataService } from "@/lib/dataService";
import { Worker, MedicalHistory } from "@/types";
import { format } from "date-fns";

export default function HistoryList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await dataService.getWorkers();
      setWorkers(data);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredWorkers = workers.filter(w => 
    w.fullName.toLowerCase().includes(search.toLowerCase()) || 
    w.dni.includes(search)
  );

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-blue-950 tracking-tight uppercase">Historias Médicas Base</h2>
          <p className="text-slate-500 font-medium tracking-tight">Alcaldía Municipio Juan Antonio Sotillo</p>
        </div>
      </div>

      <Card className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar ciudadano por nombre o C.I..."
              className="pl-10 bg-white border-slate-300 rounded-lg text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center">
               <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4 opacity-50" />
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando base de datos...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/20">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-4">Ciudadano</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-4">Cédula</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-4">Estatus Perfil</TableHead>
                  <TableHead className="text-right text-[10px] font-black text-slate-500 uppercase tracking-widest px-6 py-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.map((worker) => (
                  <TableRow key={worker.id} className="hover:bg-slate-50/50 border-b border-slate-50 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                            {worker.fullName.charAt(0)}
                         </div>
                         <span className="font-bold text-slate-700 text-sm uppercase">{worker.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <span className="text-xs font-black text-slate-500">{worker.dni}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${worker.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                         {worker.status === 'active' ? 'AL DÍA' : 'PENDIENTE'}
                       </span>
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <Dialog>
                        <DialogTrigger render={
                          <Button variant="ghost" size="sm" className="h-8 font-black text-[10px] uppercase tracking-widest text-blue-600 hover:bg-blue-50">
                             <FileText className="w-3.5 h-3.5 mr-2" /> Editar Antecedentes
                          </Button>
                        } />
                        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="font-black text-blue-900 uppercase">Ficha de Antecedentes - {worker.fullName}</DialogTitle>
                            <CardDescription className="uppercase text-[10px] font-bold">Municipio Sotillo - Bienestar Social</CardDescription>
                          </DialogHeader>
                          <div className="mt-4">
                             <MedicalHistoryForm workerId={worker.id} />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredWorkers.length === 0 && (
                   <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs uppercase font-bold">Sin resultados coincidentes.</TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

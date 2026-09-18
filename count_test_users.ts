import "dotenv/config";
import prisma from "./src/lib/prisma";

async function main(){
  const count = await prisma.user.count({where:{email:{contains:"@test.local"}}});
  console.log('Test users remaining:', count);
  const users = await prisma.user.findMany({where:{email:{contains:"@test.local"}}, select:{id:true,email:true}});
  console.log('List:', users);
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
